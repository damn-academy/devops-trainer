-- dt.lua: the trainer's read-only agent for Neovim in the lab-editors image.
--
-- Installed as /usr/share/nvim/site/plugin/dt.lua, so it loads with any
-- user config and is skipped by `nvim -u NONE`, `--clean` and `--noplugin`
-- (the trainer then reports the editor as not instrumented).
--
--   - serverstart('/run/dt/nvim.<pid>.sock'): the service shell sends one
--     fixed msgpack-rpc request, nvim_exec_lua('return DtState()', {}), and
--     reads the JSON string back;
--   - /run/dt/nvim.<pid>.stamp changes whenever the text, the mode, a macro
--     recording, the unnamed register, quickfix or the window layout changes;
--   - /run/dt/nvim.<pid>.json holds the same JSON after a save, on
--     CursorHold, on :DtDone and on exit.
--
-- It never changes buffers, registers, marks, undo or options.

if vim.g.loaded_dt_agent or vim.fn.has('unix') == 0 then
  return
end
vim.g.loaded_dt_agent = true

local dir = '/run/dt'
if vim.fn.isdirectory(dir) == 0 then
  pcall(vim.fn.mkdir, dir, 'p', tonumber('700', 8))
end
if vim.fn.filewritable(dir) ~= 2 then
  return
end

local base = dir .. '/nvim.' .. vim.fn.getpid()
-- Letters of a non-Latin layout typed where Neovim expects commands (Normal and Visual mode).
local nonlatin = { count = 0, last = '', mode = '' }
local MAXTEXT = 65536
local REGS = '"0123456789abcdefghijklmnopqrstuvwxyz-.:/'
local OPTS = { 'number', 'relativenumber', 'hlsearch', 'incsearch', 'ignorecase', 'smartcase', 'expandtab', 'shiftwidth', 'tabstop', 'softtabstop', 'autoindent', 'wrap', 'list', 'spell', 'spelllang', 'textwidth', 'fileformat', 'fileencoding', 'filetype', 'undofile', 'hidden', 'wrapscan', 'magic', 'iskeyword', 'nrformats', 'foldmethod', 'foldlevel', 'clipboard', 'mouse', 'virtualedit', 'scrolloff', 'modified' }

local function full(name)
  return name == '' and '' or vim.fn.fnamemodify(name, ':p')
end

local function buf(b, cur)
  local name = full(b.name)
  local o = {
    nr = b.bufnr, name = name, file = name, modified = b.changed == 1, changedtick = b.changedtick,
    listed = b.listed == 1, loaded = b.loaded == 1, hidden = b.hidden == 1, current = b.bufnr == cur,
    lnum = b.lnum, lines = b.linecount,
    filetype = vim.bo[b.bufnr].filetype, buftype = vim.bo[b.bufnr].buftype, readonly = vim.bo[b.bufnr].readonly,
  }
  if b.loaded == 1 then
    local text = table.concat(vim.api.nvim_buf_get_lines(b.bufnr, 0, -1, false), '\n')
    if #text <= MAXTEXT then o.text = text else o.truncated = true end
  end
  return o
end

local function mark(m)
  return { mark = (m.mark:gsub("^'", '')), buf = m.pos[1], lnum = m.pos[2], col = m.pos[3], file = m.file and full(m.file) or full(vim.fn.bufname(m.pos[1])) }
end

-- The whole state as a JSON string (the same fields as dt.vim, plus Neovim's own).
function DtState()
  local cur = vim.api.nvim_get_current_buf()
  local m = vim.api.nvim_get_mode()
  local s = {
    agent = 1, version = tostring(vim.version()), pid = vim.fn.getpid(), mode = vim.fn.mode(), mode1 = m.mode, blocking = m.blocking,
    recording = vim.fn.reg_recording(), executing = vim.fn.reg_executing(), cwd = vim.fn.getcwd(), current = cur,
  }
  s.buffers = {}
  for _, b in ipairs(vim.fn.getbufinfo()) do
    if b.listed == 1 or b.loaded == 1 then table.insert(s.buffers, buf(b, cur)) end
  end
  local pos = vim.fn.getcurpos()
  s.cursor = { lnum = pos[2], col = pos[3] }
  s.reg, s.regtype, s.regkeys = vim.empty_dict(), vim.empty_dict(), vim.empty_dict()
  for r in REGS:gmatch('.') do
    local v = vim.fn.getreg(r)
    if v ~= '' then
      s.reg[r] = v:sub(1, 4096)
      s.regtype[r] = vim.fn.getregtype(r)
      -- Macros in key notation (`A;<Esc>j`): raw bytes of special keys do not survive JSON.
      if r:match('^[a-z]$') then s.regkeys[r] = vim.fn.keytrans(v) end
    end
  end
  s.marks = {}
  for _, x in ipairs(vim.fn.getmarklist()) do table.insert(s.marks, mark(x)) end
  for _, x in ipairs(vim.fn.getmarklist(cur)) do table.insert(s.marks, mark(x)) end
  local j = vim.fn.getjumplist()
  s.jumps = { count = #j[1], idx = j[2] }
  local q = vim.fn.getqflist({ all = 1 })
  local items = {}
  for i, it in ipairs(q.items or {}) do
    if i > 50 then break end
    table.insert(items, { file = full(vim.fn.bufname(it.bufnr)), lnum = it.lnum, col = it.col, text = it.text, type = it.type })
  end
  s.qf = { title = q.title or '', count = q.size or 0, idx = q.idx or 0, items = items }
  s.windows = {}
  for _, w in ipairs(vim.fn.getwininfo()) do
    table.insert(s.windows, { winnr = w.winnr, winid = w.winid, tab = w.tabnr, buf = w.bufnr, height = w.height, width = w.width, topline = w.topline, botline = w.botline, quickfix = w.quickfix == 1, terminal = w.terminal == 1 })
  end
  s.layout = vim.fn.winlayout()
  s.tabs = vim.fn.tabpagenr('$')
  local u = vim.fn.undotree()
  s.undo = { seq_last = u.seq_last, seq_cur = u.seq_cur, save_last = u.save_last, save_cur = u.save_cur, synced = u.synced == 1, entries = #u.entries }
  s.opt = {}
  for _, o in ipairs(OPTS) do
    local ok, v = pcall(function() return vim.o[o] end)
    if ok then s.opt[o] = v end
  end
  s.nonlatin = nonlatin
  s.errmsg = vim.v.errmsg
  s.lsp = {}
  for _, c in ipairs(vim.lsp.get_clients and vim.lsp.get_clients() or {}) do table.insert(s.lsp, { name = c.name, id = c.id }) end
  s.diagnostics = #vim.diagnostic.get()
  if vim.pack and vim.pack.get then
    local ok, list = pcall(vim.pack.get)
    if ok then
      s.packs = {}
      for _, p in ipairs(list) do table.insert(s.packs, { name = p.spec and p.spec.name or '', active = p.active == true }) end
    end
  end
  return vim.json.encode(s)
end

local function write(path, text)
  local f = io.open(path, 'w')
  if f then f:write(text, '\n'); f:close() end
end

local function write_state()
  pcall(function() write(base .. '.json', DtState()) end)
end

local last, tick = nil, 0
local function signature()
  local q = vim.fn.getqflist({ size = 0 })
  return table.concat({ nonlatin.count, vim.fn.changenr(), vim.b.changedtick, vim.api.nvim_get_current_buf(), vim.api.nvim_get_mode().mode, vim.fn.reg_recording(), vim.fn.winnr('$'), vim.bo.modified and 1 or 0, #vim.fn.getreg('"'), q.size or 0 }, ' ')
end

local server = pcall(vim.fn.serverstart, base .. '.sock')

local function bump()
  local ok, sig = pcall(signature)
  if not ok or sig == last then return end
  last, tick = sig, tick + 1
  write(base .. '.stamp', tick .. ' ' .. sig)
  if not server then vim.defer_fn(write_state, 150) end
end

-- Keys before Neovim acts on them: a non-Latin letter in Normal or Visual mode is almost always
-- a layout left on Russian. Keys that take a character argument (f, t, r, m, q, @, quotes) accept any letter.
local prevkey = ''
vim.on_key(function(_, typed)
  if not typed or typed == '' then return end
  local after = prevkey
  prevkey = typed
  local m = vim.api.nvim_get_mode().mode
  if not (m == 'n' or m == 'v' or m == 'V' or m == '\22') or after:match('^[fFtTrm`\'"@q]$') then return end
  if typed:byte(1) == 0x80 or vim.fn.strcharlen(typed) ~= 1 or typed:byte(1) < 128 then return end
  nonlatin = { count = nonlatin.count + 1, last = typed, mode = m }
  vim.schedule(function() pcall(bump) end)
end, vim.api.nvim_create_namespace('dt_agent_keys'))

vim.api.nvim_create_user_command('DtDone', function() write_state(); bump() end, {})

local group = vim.api.nvim_create_augroup('dt_agent', { clear = true })
vim.api.nvim_create_autocmd({ 'SafeState', 'ModeChanged', 'BufWritePost', 'BufEnter', 'WinNew', 'WinClosed', 'QuickFixCmdPost', 'RecordingLeave' }, {
  group = group,
  callback = function(ev)
    -- The register is filled after RecordingLeave.
    if ev.event == 'RecordingLeave' then vim.defer_fn(bump, 30) else bump() end
  end,
})
vim.api.nvim_create_autocmd({ 'BufWritePost', 'CursorHold' }, { group = group, callback = write_state })
vim.api.nvim_create_autocmd('VimLeavePre', {
  group = group,
  callback = function()
    write_state()
    os.rename(base .. '.json', dir .. '/nvim.last.json')
    os.remove(base .. '.stamp')
  end,
})

bump()
