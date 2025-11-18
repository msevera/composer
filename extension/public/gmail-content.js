(() => {
  const CONTAINER_ID = 'snail-gmail-overlay';
  const state = {
    mounted: false,
    authenticated: false,
    root: null,
  };

  const isConversationView = () => /#.+\/.+/.test(window.location.hash || '');
  const shouldDisplayOverlay = () => state.authenticated && isConversationView();

  function clickReplyButton() {
    const replyButton =
      document.querySelector(`[jsaction$='.CLIENT'] [class="amn"] [role='link']`);
    if (replyButton instanceof HTMLElement) {
      replyButton.click();
      return true;
    }
    console.info('[Snail] Reply button not found on this Gmail view.');
    return false;
  }

  function insertIntoComposer(value) {
    const editor = document.querySelector('.editable');
    if (editor && 'innerHTML' in editor) {
      editor.focus();
      editor.innerHTML = '';
      const textNode = document.createTextNode(value);
      editor.appendChild(textNode);
      const selectionUpdate = new InputEvent('input', { bubbles: true, cancelable: true });
      editor.dispatchEvent(selectionUpdate);
      return true;
    }
    return false;
  }

  function createOverlay() {
    if (state.root) {
      state.root.style.display = shouldDisplayOverlay() ? 'block' : 'none';
      return;
    }

    const root = document.createElement('div');
    root.id = CONTAINER_ID;
    root.style.position = 'fixed';
    root.style.left = '50%';
    root.style.bottom = '24px';
    root.style.transform = 'translateX(-50%)';
    root.style.zIndex = '2147483647';
    root.style.pointerEvents = 'none';
    root.style.display = shouldDisplayOverlay() ? 'block' : 'none';

    const card = document.createElement('div');
    card.style.pointerEvents = 'auto';
    card.style.background = '#0f172a';
    card.style.color = '#f8fafc';
    card.style.borderRadius = '999px';
    card.style.boxShadow =
      '0 20px 25px -5px rgba(15,23,42,0.2), 0 10px 10px -5px rgba(15,23,42,0.25)';
    card.style.padding = '8px 12px 8px 20px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.minWidth = '320px';
    card.style.maxWidth = '520px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Send a quick Snail note…';
    Object.assign(input.style, {
      flex: '1',
      border: 'none',
      background: 'transparent',
      color: 'inherit',
      fontSize: '14px',
      outline: 'none',
    });

    const button = document.createElement('button');
    button.textContent = 'Send';
    Object.assign(button.style, {
      border: 'none',
      borderRadius: '999px',
      background: '#6366f1',
      color: '#fff',
      fontSize: '13px',
      fontWeight: '600',
      padding: '8px 16px',
      cursor: 'pointer',
      transition: 'background 0.2s ease',
      opacity: '0.6',
    });
    button.disabled = true;

    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = '#4f46e5';
      }
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = button.disabled ? '#6366f1' : '#6366f1';
    });

    input.addEventListener('input', () => {
      button.disabled = input.value.trim().length === 0;
      button.style.opacity = button.disabled ? '0.6' : '1';
      button.style.cursor = button.disabled ? 'not-allowed' : 'pointer';
    });

    button.addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) return;
      console.info('[Snail] Quick note from Gmail:', value);
      const replied = clickReplyButton();
      if (replied) {
        setTimeout(() => {
          if (!insertIntoComposer(value)) {
            console.info('[Snail] Could not find Gmail composer to insert text.');
          }
        }, 300);
      } else {
        if (!insertIntoComposer(value)) {
          console.info('[Snail] Could not find Gmail composer to insert text.');
        }
      }
      input.value = '';
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    });

    card.append(input, button);
    root.append(card);
    document.body.append(root);

    state.root = root;
    state.mounted = true;
  }

  function updateOverlayVisibility() {
    if (!state.root) return;
    state.root.style.display = shouldDisplayOverlay() ? 'block' : 'none';
  }

  function setAuthenticated(nextValue) {
    state.authenticated = Boolean(nextValue);
    if (!state.authenticated && state.root) {
      state.root.style.display = 'none';
      return;
    }
    if (state.authenticated) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          createOverlay();
          updateOverlayVisibility();
        });
      } else {
        createOverlay();
        updateOverlayVisibility();
      }
    }
  }

  function initStorageListener() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }

    chrome.storage.local.get('snailAuthenticated', (data) => {
      setAuthenticated(Boolean(data.snailAuthenticated));
      updateOverlayVisibility();
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !('snailAuthenticated' in changes)) {
        return;
      }
      setAuthenticated(Boolean(changes.snailAuthenticated.newValue));
      updateOverlayVisibility();
    });
  }

  window.addEventListener('hashchange', () => {
    updateOverlayVisibility();
  });

  initStorageListener();
})();

