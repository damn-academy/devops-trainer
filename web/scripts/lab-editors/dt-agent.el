;;; dt-agent.el --- the trainer's read-only agent for Emacs  -*- lexical-binding: t -*-

;; Loaded from site-start.el of the lab-editors image, before the learner's
;; own init file. `emacs -q' keeps it; `emacs -Q' and `--no-site-file' skip
;; it, and the trainer then reports the editor as not instrumented.
;;
;; - A local socket /run/dt/emacs.<pid>.sock that answers one fixed request:
;;   the line "state" gets the JSON of `dt-agent-state' and the connection
;;   closes.  It is not `server-start': nothing is evaluated from the socket,
;;   and the learner's own server (and `server-name') stays untouched.
;; - /run/dt/emacs.<pid>.stamp changes when the selected buffer, its text,
;;   point, the mark, the kill ring or the window layout change (checked by
;;   an idle timer, 0.3 s after each burst of commands, and after saving).
;; - /run/dt/emacs.<pid>.json holds the same JSON after a save, on
;;   `M-x dt-check' and on exit.
;;
;; Read-only: no `switch-to-buffer', no change of buffers, the kill ring,
;; `buffer-undo-list' or `recent-keys'.

;;; Code:

(defvar dt-agent-dir "/run/dt")
(defvar dt-agent--base nil)
(defvar dt-agent--server nil)
(defvar dt-agent--last nil)
(defvar dt-agent--tick 0)
(defconst dt-agent--max-text 65536)

(defun dt-agent--bool (x) (if x t :false))

(defun dt-agent--str (s &optional max)
  (if (stringp s)
      (let ((s (substring-no-properties s)))
        (if (and max (> (length s) max)) (substring s 0 max) s))
    :null))

(defun dt-agent--names (syms)
  (vconcat (delq nil (mapcar (lambda (m) (and (symbolp m) (symbol-name m))) syms))))

(defun dt-agent--buffer (b selected)
  (with-current-buffer b
    (let* ((win (get-buffer-window b))
           (pt (if win (window-point win) (point)))
           (o `((name . ,(buffer-name))
                (file . ,(or buffer-file-name :null))
                (modified . ,(dt-agent--bool (buffer-modified-p)))
                (current . ,(dt-agent--bool (eq b selected)))
                (point . ,pt)
                (line . ,(line-number-at-pos pt t))
                (column . ,(save-excursion (goto-char pt) (current-column)))
                (mark . ,(or (mark t) :null))
                (region . ,(dt-agent--bool (and mark-active (mark t))))
                (major . ,(symbol-name major-mode))
                (minor . ,(dt-agent--names (bound-and-true-p local-minor-modes)))
                (readonly . ,(dt-agent--bool buffer-read-only))
                (size . ,(buffer-size))
                (lines . ,(count-lines (point-min) (point-max))))))
      (when (<= (buffer-size) dt-agent--max-text)
        (push (cons 'text (save-restriction (widen) (buffer-substring-no-properties (point-min) (point-max)))) o))
      o)))

(defun dt-agent--registers ()
  (let (out)
    (dolist (r register-alist)
      (let ((k (char-to-string (car r))) (v (cdr r)))
        (cond ((stringp v) (push (cons (intern k) (dt-agent--str v 4096)) out))
              ((markerp v) (push (cons (intern k) (format "marker %s:%s" (and (marker-buffer v) (buffer-name (marker-buffer v))) (marker-position v))) out))
              ((numberp v) (push (cons (intern k) (number-to-string v)) out)))))
    (or (nreverse out) :null)))

(defun dt-agent-state ()
  "The editor state as an alist, ready for `json-serialize'."
  (let* ((win (selected-window))
         (sel (window-buffer win)))
    `((agent . 1)
      (version . ,emacs-version)
      (pid . ,(emacs-pid))
      (buffers . ,(vconcat (mapcar (lambda (b) (dt-agent--buffer b sel))
                                   (seq-remove (lambda (b) (string-prefix-p " " (buffer-name b))) (buffer-list)))))
      (selected . ,(buffer-name sel))
      (point . ,(window-point win))
      (mark . ,(or (with-current-buffer sel (mark t)) :null))
      (major . ,(symbol-name (buffer-local-value 'major-mode sel)))
      (minor . ,(dt-agent--names (append (buffer-local-value 'local-minor-modes sel) (bound-and-true-p global-minor-modes))))
      (killring . ,(vconcat (mapcar (lambda (s) (dt-agent--str s 4096)) (seq-take kill-ring 10))))
      (killhead . ,(dt-agent--str (car kill-ring) 4096))
      (killcount . ,(length kill-ring))
      (registers . ,(dt-agent--registers))
      (macro . ,(if last-kbd-macro (key-description last-kbd-macro) :null))
      (defining . ,(dt-agent--bool defining-kbd-macro))
      (minibuffer . ,(dt-agent--bool (active-minibuffer-window)))
      (windows . ,(vconcat (mapcar (lambda (w) `((buffer . ,(buffer-name (window-buffer w))) (point . ,(window-point w)) (start . ,(window-start w)) (height . ,(window-height w)) (width . ,(window-width w)))) (window-list nil 'no-minibuf))))
      (lastcommand . ,(if (symbolp last-command) (symbol-name last-command) :null))
      (cwd . ,(expand-file-name default-directory)))))

(defun dt-agent-json ()
  (condition-case nil
      (json-serialize (dt-agent-state))
    ;; A buffer with raw bytes cannot go into JSON: send the state without texts.
    (error (let ((s (dt-agent-state)))
             (setf (alist-get 'buffers s) (vconcat (mapcar (lambda (b) (assq-delete-all 'text (copy-alist b))) (alist-get 'buffers s))))
             (json-serialize s)))))

(defun dt-agent--write (file text)
  (let ((coding-system-for-write 'utf-8-unix)
        (create-lockfiles nil)
        (inhibit-message t)
        (write-region-inhibit-fsync t))
    (ignore-errors (write-region text nil file nil 0))))

(defun dt-agent--write-state ()
  (dt-agent--write (concat dt-agent--base ".json") (dt-agent-json)))

(defun dt-agent--signature ()
  (let* ((win (selected-window)) (b (window-buffer win)))
    (format "%s %s %s %s %s %s %s %s"
            (buffer-name b) (buffer-modified-tick b) (buffer-modified-p b) (window-point win)
            (with-current-buffer b (mark t)) (length kill-ring) (sxhash-equal (car kill-ring))
            (length (window-list nil 'no-minibuf)))))

(defun dt-agent--bump ()
  (ignore-errors
    (let ((sig (dt-agent--signature)))
      (unless (equal sig dt-agent--last)
        (setq dt-agent--last sig dt-agent--tick (1+ dt-agent--tick))
        (dt-agent--write (concat dt-agent--base ".stamp") (format "%d %s\n" dt-agent--tick sig))))))

(defun dt-agent--filter (proc string)
  (let ((buf (concat (or (process-get proc :in) "") string)))
    (process-put proc :in buf)
    (when (string-search "\n" buf)
      (process-send-string proc (if (equal (string-trim buf) "state") (concat (dt-agent-json) "\n") "{\"error\":\"unknown request\"}\n"))
      (process-send-eof proc))))

(defun dt-agent-check ()
  "Ask the trainer to check the goals now (the state is saved for it)."
  (interactive)
  (dt-agent--write-state)
  (setq dt-agent--last nil)
  (dt-agent--bump)
  (message "dt: sent to the trainer"))

(defalias 'dt-check #'dt-agent-check)

(defun dt-agent--leave ()
  (ignore-errors
    (dt-agent--write-state)
    (rename-file (concat dt-agent--base ".json") (expand-file-name "emacs.last.json" dt-agent-dir) t)
    (delete-file (concat dt-agent--base ".stamp"))
    (when dt-agent--server (delete-process dt-agent--server))
    (delete-file (concat dt-agent--base ".sock"))))

(defun dt-agent-start ()
  (when (and (not noninteractive)
             (or (file-directory-p dt-agent-dir) (ignore-errors (make-directory dt-agent-dir t) t))
             (file-writable-p dt-agent-dir))
    (setq dt-agent--base (expand-file-name (format "emacs.%d" (emacs-pid)) dt-agent-dir))
    (ignore-errors (delete-file (concat dt-agent--base ".sock")))
    (setq dt-agent--server
          (ignore-errors
            (make-network-process :name "dt-agent" :family 'local :server t :noquery t
                                  :service (concat dt-agent--base ".sock")
                                  :coding 'utf-8-unix :filter #'dt-agent--filter)))
    (run-with-idle-timer 0.3 t #'dt-agent--bump)
    (add-hook 'after-save-hook #'dt-agent--bump)
    (add-hook 'after-save-hook #'dt-agent--write-state)
    (add-hook 'kill-emacs-hook #'dt-agent--leave)
    (dt-agent--bump)))

(dt-agent-start)

(provide 'dt-agent)
;;; dt-agent.el ends here
