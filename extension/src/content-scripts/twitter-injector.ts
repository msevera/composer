class TwitterReplyInjector {
  private findComposeBox(): HTMLElement | null {
    return document.querySelector('div[data-testid="tweetTextarea_0"]') ||
           document.querySelector('div[role="textbox"][data-focusable="true"]');
  }
  
  async injectContent(generatedContent: string): Promise<void> {
    const replyButton = document.querySelector('div[data-testid="reply"]');
    if (replyButton) {
      (replyButton as HTMLElement).click();
      await this.waitForComposeBox();
    }
    
    const composeBox = this.findComposeBox();
    if (!composeBox) throw new Error('Twitter compose box not found');
    
    composeBox.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertText', false, generatedContent);
    composeBox.dispatchEvent(new Event('input', { bubbles: true }));
  }
  
  private async waitForComposeBox(timeout = 2000): Promise<void> {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
      if (this.findComposeBox()) return;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error('Compose box did not appear');
  }
}

export default TwitterReplyInjector;

