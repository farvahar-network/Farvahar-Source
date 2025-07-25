const connectButton = document.querySelector('.connect-button');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('strong');
const pingField = document.getElementById('ping');
const serverField = document.getElementById('currentServer');

const serverIP = '';
const serverTag = '';

serverField.value = `${serverTag} (${serverIP})`;
pingField.value = '-1 ms';

connectButton.onclick = async () => {
  const currentlyConnected = statusText.textContent === 'Connected';

  if (!currentlyConnected) {
    statusText.textContent = 'Connected';
    statusDot.classList.add('connected');

    ipcRenderer.send('connect-x');

    try {
      const pingResult = await ipcRenderer.invoke('ping-server', serverIP);
      pingField.value = pingResult;
    } catch (err) {
      console.error('خطا در دریافت پینگ:', err);
      pingField.value = 'خطا';
    }
  } else {
    statusText.textContent = 'Disconnected';
    statusDot.classList.remove('connected');
    pingField.value = '-1 ms';
  }
};
