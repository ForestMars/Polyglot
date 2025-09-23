# Troubleshooting Guide

## Client Issues

### Chat Data Not Persisting
**Symptoms**: Chats disappear after browser refresh
**Causes**:
- IndexedDB quota exceeded
- Browser storage disabled
- Incognito/private browsing mode

**Solutions**:
```javascript
// Check IndexedDB support
if (!window.indexedDB) {
  console.error('IndexedDB not supported');
}

// Check storage quota
navigator.storage.estimate().then(estimate => {
  console.log(`Used: ${estimate.usage}, Quota: ${estimate.quota}`);
});
Sync Not Working
Symptoms: Changes don't appear on other devices
Solutions:

Verify server is running: curl http://localhost:4001/fetchChats
Check browser console for CORS errors
Confirm network connectivity
Test with: fetch('http://localhost:4001/sync', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({chats: []})})

Server Issues
Server Won't Start
Error: EADDRINUSE: address already in use
Solution:
bash# Find process using port 4001
lsof -i :4001
# Kill the process
kill -9 <PID>
Chat Data Corrupted
Symptoms: Server returns empty array or errors
Solution:
bash# Backup current data
cp chatStore.json chatStore.json.backup
# Reset to empty array
echo "[]" > chatStore.json
Browser Compatibility

Chrome 61+: Full support
Firefox 60+: Full support
Safari 13.1+: Full support
Edge 79+: Full support
IE: Not supported (IndexedDB limitations)

Performance Issues

Large chat history: Archive old chats or implement pagination
Slow sync: Check network latency and server response times
High memory usage: Clear browser cache and restart
