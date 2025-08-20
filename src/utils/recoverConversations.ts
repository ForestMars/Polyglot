/**
 * Utility to help recover conversations from localStorage
 */

export function recoverConversations(): void {
  console.log('=== Starting Conversation Recovery ===');
  
  // Get all keys from localStorage
  const allKeys = Object.keys(localStorage);
  
  // Filter for conversation-related keys
  const conversationKeys = allKeys.filter(key => key.includes('conversations/') || key.includes('polyglut'));
  
  if (conversationKeys.length === 0) {
    console.log('No conversation data found in localStorage');
    return;
  }
  
  console.log(`Found ${conversationKeys.length} potential conversation keys in localStorage:`);
  
  // Try to parse and display conversation data
  conversationKeys.forEach((key, index) => {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        console.log(`\n--- Conversation ${index + 1} (${key}) ---`);
        const parsed = JSON.parse(data);
        
        // Try to extract basic info
        if (typeof parsed === 'object' && parsed !== null) {
          if (parsed.id) console.log(`ID: ${parsed.id}`);
          if (parsed.title) console.log(`Title: ${parsed.title}`);
          if (parsed.lastModified) console.log(`Last Modified: ${new Date(parsed.lastModified).toLocaleString()}`);
          if (parsed.messages?.length) console.log(`Messages: ${parsed.messages.length}`);
        }
        
        console.log('Raw data preview:', JSON.stringify(parsed).substring(0, 200) + '...');
      }
    } catch (error) {
      console.error(`Error processing key ${key}:`, error);
    }
  });
  
  console.log('\n=== Recovery Complete ===');
  console.log('To save this data, run: localStorage.backup = JSON.stringify(localStorage);');
  console.log('Then copy the contents of localStorage.backup to a file');
}

// Run recovery if this file is executed directly
if (typeof window !== 'undefined') {
  // @ts-ignore - This is for browser execution
  window.recoverConversations = recoverConversations;
  console.log('Recovery function available as window.recoverConversations()');
}
