import GmailDraftInjector from './gmail-injector';
import TwitterReplyInjector from './twitter-injector';

class UniversalComposerInjector {
  private injector: GmailDraftInjector | TwitterReplyInjector | null = null;
  
  private detectPlatform(): 'gmail' | 'twitter' | null {
    const hostname = window.location.hostname;
    
    if (hostname.includes('mail.google.com')) return 'gmail';
    if (hostname.includes('twitter.com') || hostname.includes('x.com')) return 'twitter';
    
    return null;
  }
  
  async initialize() {
    const platform = this.detectPlatform();
    
    if (platform === 'gmail') {
      this.injector = new GmailDraftInjector();
      this.renderInputField({ position: 'bottom-fixed', context: 'email' });
    } else if (platform === 'twitter') {
      this.injector = new TwitterReplyInjector();
      this.renderInputField({ position: 'floating', context: 'tweet' });
    }
  }
  
  private renderInputField(config: { position: string, context: string }) {
    const inputContainer = document.createElement('div');
    inputContainer.id = 'smail-composer-input';
    inputContainer.style.cssText = `
      position: fixed;
      ${config.position === 'bottom-fixed' ? 'bottom: 20px;' : 'bottom: 80px;'}
      right: 20px;
      width: 400px;
      z-index: 10000;
      background: white;
      border: 1px solid #ccc;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      padding: 16px;
    `;
    
    inputContainer.innerHTML = `
      <textarea 
        id="smail-prompt-input" 
        placeholder="Describe the ${config.context} you want to compose..."
        style="width: 100%; height: 80px; border: 1px solid #ddd; border-radius: 4px; padding: 8px;"
      ></textarea>
      <button 
        id="smail-generate-btn"
        style="margin-top: 8px; padding: 8px 16px; background: #1da1f2; color: white; border: none; border-radius: 4px; cursor: pointer;"
      >
        Generate ${config.context === 'email' ? 'Draft' : 'Reply'}
      </button>
    `;
    
    document.body.appendChild(inputContainer);
    
    document.getElementById('smail-generate-btn')?.addEventListener('click', () => {
      this.handlePromptSubmit();
    });
  }
  
  private extractContext(platform: 'gmail' | 'twitter'): any {
    if (platform === 'gmail') {
      const match = window.location.hash.match(/#inbox\/([a-zA-Z0-9]+)/);
      return { threadId: match ? match[1] : null };
    } else if (platform === 'twitter') {
      const match = window.location.href.match(/status\/(\d+)/);
      return { threadId: match ? match[1] : null };
    }
    return {};
  }
  
  async handlePromptSubmit() {
    const platform = this.detectPlatform();
    if (!platform || !this.injector) return;
    
    const promptInput = document.getElementById('smail-prompt-input') as HTMLTextAreaElement;
    const prompt = promptInput.value.trim();
    if (!prompt) return;
    
    try {
      const mutation = platform === 'gmail' ? 'composeDraft' : 'composeTweet';
      
      // Get auth token from storage
      const authToken = await this.getUserToken();
      
      // Call GraphQL API
      const response = await fetch('http://localhost:4000/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          query: `
            mutation {
              ${mutation}(input: {
                prompt: "${prompt.replace(/"/g, '\\"')}"
                ${this.extractContext(platform).threadId ? `threadId: "${this.extractContext(platform).threadId}"` : ''}
              }) {
                content
                sources
              }
            }
          `,
        }),
      });
      
      const result = await response.json();
      const content = result.data?.[mutation]?.content;
      
      if (content) {
        await this.injector.injectContent(content);
        promptInput.value = '';
      }
    } catch (error) {
      console.error('Error composing draft:', error);
    }
  }
  
  private async getUserToken(): Promise<string> {
    return new Promise((resolve) => {
      chrome.storage.local.get(['authToken'], (result: { [key: string]: any }) => {
        resolve((result.authToken as string) || '');
      });
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new UniversalComposerInjector().initialize();
  });
} else {
  new UniversalComposerInjector().initialize();
}

