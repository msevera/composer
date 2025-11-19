class GmailDraftInjector {
  private findComposeBox(): HTMLElement | null {
    return document.querySelector('div[role="textbox"][aria-label*="Message Body"]') ||
           document.querySelector('.Am.Al.editable') ||
           document.querySelector('div[g_editable="true"]');
  }
  
  async injectContent(draftContent: string): Promise<void> {
    const replyButton = document.querySelector('div[role="button"][aria-label*="Reply"]');
    if (replyButton) {
      (replyButton as HTMLElement).click();
      await this.waitForComposeBox();
    }
    
    const composeBox = this.findComposeBox();
    if (!composeBox) {
      throw new Error('Gmail compose box not found');
    }
    
    composeBox.focus();
    document.execCommand('selectAll', false);
    document.execCommand('insertHTML', false, draftContent);
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

export default GmailDraftInjector;

