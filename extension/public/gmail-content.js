(() => {
  const CONTAINER_ID = 'snail-gmail-overlay';
  const state = {
    mounted: false,
    authenticated: false,
    root: null,
  };

  function createOverlay() {
    if (state.root) {
      state.root.style.display = state.authenticated ? 'block' : 'none';
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
    root.style.display = state.authenticated ? 'block' : 'none';

    const card = document.createElement('div');
    card.style.pointerEvents = 'auto';
    card.style.background = '#0f172a';
    card.style.color = '#f8fafc';
    card.style.borderRadius = '999px';
    card.style.boxShadow = '0 20px 25px -5px rgba(15,23,42,0.2), 0 10px 10px -5px rgba(15,23,42,0.25)';
    card.style.padding = '8px 12px 8px 20px';
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '12px';
    card.style.minWidth = '320px';
    card.style.maxWidth = '520px';

    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Send a quick Snail note…';
    input.style.flex = '1';
    input.style.border = 'none';
    input.style.background = 'transparent';
    input.style.color = 'inherit';
    input.style.fontSize = '14px';
    input.style.outline = 'none';

    const button = document.createElement('button');
    button.textContent = 'Send';
    button.style.border = 'none';
    button.style.borderRadius = '999px';
    button.style.background = '#6366f1';
    button.style.color = '#fff';
    button.style.fontSize = '13px';
    button.style.fontWeight = '600';
    button.style.padding = '8px 16px';
    button.style.cursor = 'pointer';
    button.style.transition = 'background 0.2s ease';
    button.disabled = true;

    button.addEventListener('mouseenter', () => {
      if (!button.disabled) {
        button.style.background = '#4f46e5';
      }
    });
    button.addEventListener('mouseleave', () => {
      button.style.background = '#6366f1';
    });

    input.addEventListener('input', () => {
      button.disabled = input.value.trim().length === 0;
      button.style.opacity = button.disabled ? '0.6' : '1';
      button.style.cursor = button.disabled ? 'not-allowed' : 'pointer';
    });

    button.addEventListener('click', () => {
      const value = input.value.trim();
      if (!value) {
        return;
      }
      console.info('[Snail] Quick note from Gmail:', value);
      input.value = '';
      button.disabled = true;
      button.style.opacity = '0.6';
      button.style.cursor = 'not-allowed';
    });

    card.appendChild(input);
    card.appendChild(button);
    root.appendChild(card);
    document.body.appendChild(root);

    state.root = root;
    state.mounted = true;
  }

  function setAuthenticated(nextValue) {
    state.authenticated = Boolean(nextValue);
    if (!state.authenticated && state.root) {
      state.root.style.display = 'none';
      return;
    }
    if (state.authenticated) {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createOverlay, { once: true });
      } else {
        createOverlay();
      }
    }
  }

  function initStorageListener() {
    if (typeof chrome === 'undefined' || !chrome.storage?.local) {
      return;
    }

    chrome.storage.local.get('snailAuthenticated', (data) => {
      setAuthenticated(Boolean(data.snailAuthenticated));
    });

    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !('snailAuthenticated' in changes)) {
        return;
      }
      setAuthenticated(Boolean(changes.snailAuthenticated.newValue));
    });
  }

  initStorageListener();
})();

