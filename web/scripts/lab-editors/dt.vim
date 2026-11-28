" dt.vim: the trainer's read-only agent for Vim in the lab-editors image.
"
" Installed as a system plugin ($VIM/vimfiles/plugin), so the learner's own
" vimrc never has to mention it. `vim -u NONE`, `--noplugin` and `--clean`
" skip it; the trainer then reports the editor as not instrumented and judges
" files only.
"
" What it does:
"   - starts a server on the socket /run/dt/vim.<pid>.sock (the socket
"     backend of +clientserver), so the trainer's service shell can ask
"     `vim --clientserver socket --servername <sock> --remote-expr 'DtState()'`;
"   - writes a small stamp, /run/dt/vim.<pid>.stamp, whenever the text, the
"     mode, a register recording, the unnamed register, the quickfix list or
"     the window layout changes (checked on SafeState): the page polls the
"     stamp and re-runs goal checks only when it moved;
"   - writes the same JSON as DtState() to /run/dt/vim.<pid>.json on save,
"     on CursorHold, on :DtDone and on exit (the fallback when no server runs).
"
" It never changes buffers, registers, marks, the jumplist, undo or options.

if exists('g:loaded_dt_agent') || v:version < 900 || !has('unix')
  finish
endif
let g:loaded_dt_agent = 1

let s:dir = '/run/dt'
if !isdirectory(s:dir)
  silent! call mkdir(s:dir, 'p', 0700)
endif
if !isdirectory(s:dir) || !filewritable(s:dir)
  finish
endif

let s:base = s:dir . '/vim.' . getpid()
let s:tick = 0
" Letters of a non-Latin layout typed where Vim expects commands (Normal and Visual mode).
let s:nonlatin = {'count': 0, 'last': '', 'mode': ''}
let s:prevkey = ''
let s:server = 0
let s:MAXTEXT = 65536
let s:REGS = '"0123456789abcdefghijklmnopqrstuvwxyz-.:/'
let s:OPTS = ['number', 'relativenumber', 'hlsearch', 'incsearch', 'ignorecase', 'smartcase', 'expandtab', 'shiftwidth', 'tabstop', 'softtabstop', 'autoindent', 'wrap', 'list', 'spell', 'spelllang', 'textwidth', 'fileformat', 'fileencoding', 'filetype', 'undofile', 'hidden', 'wrapscan', 'magic', 'iskeyword', 'nrformats', 'foldmethod', 'foldlevel', 'clipboard', 'mouse', 'virtualedit', 'scrolloff', 'modified']

function! s:Bool(x) abort
  return a:x ? v:true : v:false
endfunction

function! s:Buf(b, cur) abort
  let l:name = a:b.name ==# '' ? '' : fnamemodify(a:b.name, ':p')
  let l:o = {'nr': a:b.bufnr, 'name': l:name, 'file': l:name, 'modified': s:Bool(a:b.changed), 'changedtick': a:b.changedtick, 'listed': s:Bool(a:b.listed), 'loaded': s:Bool(a:b.loaded), 'hidden': s:Bool(a:b.hidden), 'current': s:Bool(a:cur), 'lnum': a:b.lnum, 'lines': a:b.linecount, 'filetype': getbufvar(a:b.bufnr, '&filetype'), 'buftype': getbufvar(a:b.bufnr, '&buftype'), 'readonly': s:Bool(getbufvar(a:b.bufnr, '&readonly'))}
  if a:b.loaded
    let l:text = join(getbufline(a:b.bufnr, 1, '$'), "\n")
    if strlen(l:text) <= s:MAXTEXT
      let l:o.text = l:text
    else
      let l:o.truncated = v:true
    endif
  endif
  return l:o
endfunction

function! s:Mark(m) abort
  return {'mark': substitute(a:m.mark, "^'", '', ''), 'buf': a:m.pos[0], 'lnum': a:m.pos[1], 'col': a:m.pos[2], 'file': get(a:m, 'file', bufname(a:m.pos[0]) ==# '' ? '' : fnamemodify(bufname(a:m.pos[0]), ':p'))}
endfunction

" The whole state as a JSON string (09 §2.2 field names where they exist).
function! DtState() abort
  let l:cur = bufnr('%')
  let l:s = {'agent': 1, 'version': v:versionlong, 'pid': getpid(), 'mode': mode(), 'mode1': mode(1), 'recording': reg_recording(), 'executing': reg_executing(), 'cwd': getcwd()}
  let l:s.buffers = map(filter(getbufinfo(), {_, b -> b.listed || b.loaded}), {_, b -> s:Buf(b, b.bufnr == l:cur)})
  let l:s.current = l:cur
  let l:pos = getcurpos()
  let l:s.cursor = {'lnum': l:pos[1], 'col': l:pos[2]}
  let l:reg = {}
  let l:regtype = {}
  for l:r in split(s:REGS, '\zs')
    let l:v = getreg(l:r)
    if l:v !=# ''
      let l:reg[l:r] = strpart(l:v, 0, 4096)
      let l:regtype[l:r] = getregtype(l:r)
    endif
  endfor
  let l:s.reg = l:reg
  let l:s.regtype = l:regtype
  let l:s.marks = map(getmarklist() + getmarklist(l:cur), {_, m -> s:Mark(m)})
  let l:j = getjumplist()
  let l:s.jumps = {'count': len(l:j[0]), 'idx': l:j[1]}
  let l:q = getqflist({'all': 1})
  let l:s.qf = {'title': get(l:q, 'title', ''), 'count': get(l:q, 'size', 0), 'idx': get(l:q, 'idx', 0), 'items': map(get(l:q, 'items', [])[:49], {_, i -> {'file': bufname(i.bufnr) ==# '' ? '' : fnamemodify(bufname(i.bufnr), ':p'), 'lnum': i.lnum, 'col': i.col, 'text': i.text, 'type': i.type}})}
  let l:s.windows = map(getwininfo(), {_, w -> {'winnr': w.winnr, 'winid': w.winid, 'tab': w.tabnr, 'buf': w.bufnr, 'height': w.height, 'width': w.width, 'topline': w.topline, 'botline': w.botline, 'quickfix': s:Bool(w.quickfix), 'terminal': s:Bool(w.terminal)}})
  let l:s.layout = winlayout()
  let l:s.tabs = tabpagenr('$')
  let l:u = undotree()
  let l:s.undo = {'seq_last': l:u.seq_last, 'seq_cur': l:u.seq_cur, 'save_last': l:u.save_last, 'save_cur': l:u.save_cur, 'synced': s:Bool(l:u.synced), 'entries': len(l:u.entries)}
  let l:opt = {}
  for l:o in s:OPTS
    if exists('+' . l:o)
      let l:opt[l:o] = eval('&' . l:o)
    endif
  endfor
  let l:s.opt = l:opt
  let l:s.nonlatin = s:nonlatin
  let l:s.errmsg = v:errmsg
  if exists('*maplist')
    let l:s.maps = map(filter(maplist(), {_, m -> m.lhs !~# '^<Plug>' && m.sid > 0 && get(getscriptinfo({'sid': m.sid}), 0, {'name': ''}).name !~# '^' . escape($VIMRUNTIME, '\.')})[:199], {_, m -> {'mode': m.mode, 'lhs': m.lhs, 'rhs': m.rhs, 'noremap': s:Bool(m.noremap)}})
  endif
  return json_encode(l:s)
endfunction

function! s:WriteState() abort
  silent! call writefile([DtState()], s:base . '.json')
endfunction

" A short signature of what goal checks look at; the stamp is written only when it changes.
function! s:Signature() abort
  return s:nonlatin.count . ' ' . changenr() . ' ' . b:changedtick . ' ' . bufnr('%') . ' ' . mode(1) . ' ' . reg_recording() . ' ' . winnr('$') . ' ' . &modified . ' ' . len(getreg('"')) . ' ' . getqflist({'size': 0}).size
endfunction

function! s:Bump(...) abort
  let l:sig = s:Signature()
  if l:sig ==# get(s:, 'last', '')
    return
  endif
  let s:last = l:sig
  let s:tick += 1
  silent! call writefile([s:tick . ' ' . l:sig], s:base . '.stamp')
  " Without a server the trainer reads the JSON file: keep it fresh, a moment after the change.
  if !s:server
    if exists('s:pending')
      silent! call timer_stop(s:pending)
    endif
    let s:pending = timer_start(150, {-> s:WriteState()})
  endif
endfunction

function! s:Leave() abort
  call s:WriteState()
  silent! call rename(s:base . '.json', s:dir . '/vim.last.json')
  silent! call delete(s:base . '.stamp')
endfunction

if has('clientserver') && v:servername ==# ''
  try
    call remote_startserver(s:base . '.sock')
    let s:server = 1
  catch
    let s:server = 0
  endtry
endif

" A typed key, before Vim acts on it. A non-Latin letter in Normal or Visual
" mode is almost always a keyboard layout left on Russian (or another
" non-Latin script). Keys that take a character argument (f, t, r, m, q, @,
" quotes) legitimately accept any letter, so the key after them is skipped.
function! s:KeyIn() abort
  if !get(v:event, 'typed', 1)
    return
  endif
  let l:c = v:char
  let l:m = mode()
  let l:after = s:prevkey
  let s:prevkey = l:c
  if l:m !~# '^[nvV\x16]$' || l:after =~# '^[fFtTrm`''"@q]$'
    return
  endif
  if strcharlen(l:c) == 1 && char2nr(l:c) > 127 && l:c[0] !=# "\x80" && l:c =~# '\a\|[^\x00-\x7f]'
    let s:nonlatin = {'count': s:nonlatin.count + 1, 'last': l:c, 'mode': l:m}
    call timer_start(0, function('s:Bump'))
  endif
endfunction

command! DtDone call s:WriteState() | call s:Bump()

augroup dt_agent
  autocmd!
  " SafeState: Vim waits for the next key and nothing is pending (once per command, in any mode).
  autocmd SafeState,ModeChanged,BufWritePost,BufEnter,WinNew,WinClosed,QuickFixCmdPost * call s:Bump()
  autocmd BufWritePost,CursorHold * call s:WriteState()
  autocmd VimLeavePre * call s:Leave()
  if exists('##KeyInputPre')
    autocmd KeyInputPre * call s:KeyIn()
  endif
augroup END

call s:Bump()
