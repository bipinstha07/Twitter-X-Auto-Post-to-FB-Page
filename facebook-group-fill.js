// Content script for Facebook group pages – based on reference: open composer, fill, click Post
(function () {
  function buildPostContent(text, link) {
    var parts = [];
    if (text && text.trim()) parts.push(text.trim());
    if (link && link.trim()) parts.push(link.trim());
    return parts.join("\n\n ");
  }

  function findComposerTrigger() {
    var triggers = [
      '[aria-label="Create a post"]',
      '[aria-label="Write a post"]',
      '[aria-label="Write something..."]',
      'div[role="button"][tabindex="0"]',
      'span[dir="auto"]'
    ];
    var textMatches = ["what's on your mind", "write something", "create a post", "write a post", "post something", "write something to the group", "ask the group"];
    for (var i = 0; i < triggers.length; i++) {
      var nodes = document.querySelectorAll(triggers[i]);
      for (var j = 0; j < nodes.length; j++) {
        var el = nodes[j];
        var label = (el.getAttribute("aria-label") || "").toLowerCase();
        var text = (el.textContent || "").toLowerCase().trim();
        var visible = el.offsetParent !== null && el.getBoundingClientRect().width > 50;
        if (!visible) continue;
        for (var k = 0; k < textMatches.length; k++) {
          if (label.indexOf(textMatches[k]) !== -1 || text.indexOf(textMatches[k]) !== -1) return el;
        }
      }
    }
    var all = document.querySelectorAll('[role="button"], [contenteditable="true"]');
    for (var i = 0; i < all.length; i++) {
      var t = (all[i].textContent || "").toLowerCase();
      if (t.indexOf("what's on your mind") !== -1 || t.indexOf("write something") !== -1) return all[i];
    }
    return null;
  }

  function isInsideCommentOrReplyArea(el) {
    var node = el;
    var depth = 0;
    while (node && node !== document.body && depth < 25) {
      var label = (node.getAttribute && node.getAttribute("aria-label") || "").toLowerCase();
      var placeholder = (node.getAttribute && node.getAttribute("placeholder") || "").toLowerCase();
      var text = (node.textContent || "").toLowerCase();
      if (label.indexOf("write a comment") !== -1 || label.indexOf("comment") === 0 ||
          placeholder.indexOf("write a comment") !== -1 || placeholder.indexOf("comment") !== -1 ||
          text.indexOf("write a comment") !== -1 || (text.indexOf("reply") !== -1 && text.length < 100)) {
        return true;
      }
      node = node.parentElement;
      depth++;
    }
    return false;
  }

  function findComposerEditable(triggerEl) {
    var candidates = [];
    var all = document.querySelectorAll('[role="textbox"][contenteditable="true"], [contenteditable="true"].notranslate, [data-lexical-editor="true"], [contenteditable="true"]');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (isInsideCommentOrReplyArea(el)) continue;
      var r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 20) continue;
      if (el.offsetParent === null) continue;
      candidates.push({ el: el, top: r.top, area: r.width * r.height });
    }
    if (triggerEl && triggerEl.getBoundingClientRect) {
      var triggerRect = triggerEl.getBoundingClientRect();
      var triggerMid = triggerRect.top + triggerRect.height / 2;
      candidates.sort(function (a, b) {
        var distA = Math.abs(a.top - triggerMid);
        var distB = Math.abs(b.top - triggerMid);
        return distA - distB;
      });
      if (candidates.length) return candidates[0].el;
    }
    candidates.sort(function (a, b) {
      if (Math.abs(a.top - b.top) < 80) return b.area - a.area;
      return a.top - b.top;
    });
    return candidates.length ? candidates[0].el : null;
  }

  function pasteOnce(editable, content) {
    return new Promise(function (resolve) {
      editable.focus();
      editable.scrollIntoView({ block: "center" });
      try {
        document.execCommand("insertText", false, content);
      } catch (_) {}
      resolve(true);
    });
  }

  function pasteWithCtrlV(editable, content) {
    return new Promise(function (resolve) {
      navigator.clipboard.writeText(content).then(function () {
        editable.focus();
        editable.scrollIntoView({ block: "center" });
        var k = new KeyboardEvent("keydown", { key: "v", code: "KeyV", keyCode: 86, ctrlKey: true, bubbles: true });
        editable.dispatchEvent(k);
        var k2 = new KeyboardEvent("keyup", { key: "v", code: "KeyV", keyCode: 86, ctrlKey: true, bubbles: true });
        editable.dispatchEvent(k2);
        setTimeout(resolve, 100);
      }).catch(function () { resolve(); });
    });
  }

  function pasteWithInputEvent(editable, content) {
    try {
      editable.focus();
      var inner = editable.querySelector("p") || editable.querySelector("span") || editable;
      inner.textContent = content;
      editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: content }));
      return true;
    } catch (_) {
      return false;
    }
  }

  function pasteWithExecCommand(editable, content) {
    try {
      editable.focus();
      editable.innerHTML = "";
      document.execCommand("insertText", false, content);
      return true;
    } catch (_) {
      return false;
    }
  }

  function findPostButton(nearEl) {
    var exactPost = document.querySelector('[aria-label="Post"][role="button"], [role="button"][aria-label="Post"]');
    if (exactPost && exactPost.offsetParent) {
      var p = (exactPost.closest("[aria-label]") || {}).getAttribute("aria-label") || "";
      if (p.toLowerCase().indexOf("comment") === -1) return exactPost;
    }
    var postLabels = ["post", "publish", "share"];
    var excludeLabels = ["comment", "reply", "cancel", "discard"];
    var candidates = [];
    var buttons = document.querySelectorAll("[role=\"button\"], button");
    for (var i = 0; i < buttons.length; i++) {
      var el = buttons[i];
      var label = (el.getAttribute("aria-label") || "").toLowerCase().trim();
      var text = (el.textContent || "").toLowerCase().trim().replace(/\s+/g, " ");
      if (!el.offsetParent || el.getBoundingClientRect().width < 10) continue;
      var parentWithLabel = el.closest("[aria-label]");
      if (parentWithLabel && (parentWithLabel.getAttribute("aria-label") || "").toLowerCase().indexOf("comment") !== -1) continue;
      var isExcluded = excludeLabels.some(function (x) { return label.indexOf(x) !== -1 || text === x; });
      if (isExcluded) continue;
      var isPost = label === "post" || text === "post" || text === "publish" || text === "share";
      if (!isPost) isPost = postLabels.some(function (x) { return label.indexOf(x) !== -1; });
      if (isPost && (label || text.length < 50)) {
        var clickable = el.getAttribute("role") === "button" ? el : el.closest("[role=\"button\"]") || el;
        if (nearEl) {
          var composerRoot = nearEl.closest("form") || nearEl.closest("[role=\"dialog\"]") || (function () {
            var n = nearEl;
            for (var d = 0; d < 15 && n; d++) {
              if (n.getBoundingClientRect && n.getBoundingClientRect().height > 120) return n;
              n = n.parentElement;
            }
            return null;
          })();
          if (composerRoot && composerRoot.contains(clickable)) return clickable;
        }
        candidates.push(clickable);
      }
    }
    if (candidates.length && nearEl) {
      var refTop = nearEl.getBoundingClientRect ? nearEl.getBoundingClientRect().top : 0;
      candidates.sort(function (a, b) {
        var ta = a.getBoundingClientRect ? a.getBoundingClientRect().top : 0;
        var tb = b.getBoundingClientRect ? b.getBoundingClientRect().top : 0;
        return Math.abs(ta - refTop) - Math.abs(tb - refTop);
      });
      return candidates[0];
    }
    return candidates.length ? candidates[0] : null;
  }

  function clickPostButton(editable, callback, delayBeforeFirstTry) {
    var delay = delayBeforeFirstTry != null ? delayBeforeFirstTry : 1000;
    var maxAttempts = 25;
    var retryIntervalMs = 400;

    function doClick(btn) {
      try {
        btn.focus();
        btn.scrollIntoView({ block: "center" });
        btn.click();
        setTimeout(function () { btn.click(); }, 200);
        setTimeout(function () { btn.click(); }, 500);
      } catch (_) {}
    }

    function tryClick(attempt) {
      if (attempt > maxAttempts) {
        callback(false);
        return;
      }
      var btn = findPostButton(editable);
      if (btn) {
        doClick(btn);
        try {
          chrome.runtime.sendMessage({ action: "closeGroupTabInSeconds", seconds: 5 });
        } catch (_) {}
        callback(true);
        return;
      }
      setTimeout(function () { tryClick(attempt + 1); }, retryIntervalMs);
    }
    setTimeout(function () { tryClick(0); }, delay);
  }

  var PREVIEW_WAIT_MS = 7000;
  var EDITABLE_POLL_MS = 400;
  var EDITABLE_POLL_MAX = 24;  // ~9.6s total after opening composer
  var PASTE_READY_DELAY_MS = 500;

  function waitForEditable(trigger, onFound, onGiveUp) {
    var attempt = 0;
    function poll() {
      var ed = findComposerEditable(trigger);
      if (ed && ed.offsetParent && ed.getBoundingClientRect().width > 20 && ed.getBoundingClientRect().height > 20) {
        onFound(ed);
        return;
      }
      attempt++;
      if (attempt >= EDITABLE_POLL_MAX) {
        onGiveUp();
        return;
      }
      setTimeout(poll, EDITABLE_POLL_MS);
    }
    setTimeout(poll, EDITABLE_POLL_MS);
  }

  function ensureContentInEditable(editable, content, callback) {
    var deadline = Date.now() + 3000;
    function check() {
      var has = (editable.textContent || "").trim().length > 0;
      if (has) {
        callback(true);
        return;
      }
      if (Date.now() > deadline) {
        pasteWithExecCommand(editable, content);
        setTimeout(function () { callback(true); }, 300);
        return;
      }
      setTimeout(check, 300);
    }
    setTimeout(check, 400);
  }

  function doPasteThenPost(editable, content, callback, hasLink) {
    function done() {
      var delayBeforePost = hasLink ? PREVIEW_WAIT_MS : 1500;
      clickPostButton(editable, function () { callback(true); }, delayBeforePost);
    }

    setTimeout(function () {
      pasteOnce(editable, content).then(function () {
        ensureContentInEditable(editable, content, function () { done(); });
      });
    }, PASTE_READY_DELAY_MS);
  }

  function tryFill(content, step, callback, hasLink) {
    if (step > 14) {
      callback(false);
      return;
    }
    var trigger = findComposerTrigger();
    var editable = findComposerEditable(trigger);

    if (editable && editable.offsetParent !== null) {
      var r = editable.getBoundingClientRect();
      if (r.width > 20 && r.height > 20) {
        doPasteThenPost(editable, content, callback, hasLink);
        return;
      }
    }

    if (trigger && trigger.offsetParent !== null) {
      try {
        trigger.click();
      } catch (_) {}
      waitForEditable(trigger, function (ed) {
        doPasteThenPost(ed, content, callback, hasLink);
      }, function () {
        tryFill(content, step + 1, callback, hasLink);
      });
      return;
    }

    setTimeout(function () {
      tryFill(content, step + 1, callback, hasLink);
    }, 600);
  }

  chrome.runtime.onMessage.addListener(function (msg, _sender, sendResponse) {
    if (msg.action !== "fillPost") {
      sendResponse({ ok: false });
      return true;
    }
    var content = buildPostContent(msg.text || "", msg.link || "");
    if (!content) {
      sendResponse({ ok: false });
      return true;
    }
    var hasLink = !!(msg.link && String(msg.link).trim());
    navigator.clipboard.writeText(content).catch(function () {});
    tryFill(content, 0, function (ok) {
      sendResponse({ ok: ok });
    }, hasLink);
    return true;
  });
})();
