const { ipcRenderer } = require('electron');

const pingBtn = document.getElementById('pingAll');
const clearCacheBtn = document.getElementById('clearCache');
const boostPerfBtn = document.getElementById('boostPerf');
const sysInfoBtn = document.getElementById('sysInfo');
const output = document.getElementById('output');

function appendOutput(text) {
  output.textContent += text + '\n';
  output.scrollTop = output.scrollHeight;
}

pingBtn.addEventListener('click', async () => {
  output.textContent = 'Pinging all game servers...\n';
  const results = await ipcRenderer.invoke('ping-all-games');
  for (const [game, ping] of Object.entries(results)) {
    appendOutput(`${game.toUpperCase()}: ${ping}`);
  }
  appendOutput('\nDone.');
});

clearCacheBtn.addEventListener('click', async () => {
  output.textContent = 'Clearing network cache...\n';
  const res = await ipcRenderer.invoke('clear-network-cache');
  appendOutput(`Network cache clearing status: ${res}\n`);
});

boostPerfBtn.addEventListener('click', async () => {
  output.textContent = 'Boosting system performance...\n';
  const res = await ipcRenderer.invoke('boost-performance');
  appendOutput(`Performance boost status: ${res}\n`);
});

sysInfoBtn.addEventListener('click', async () => {
  output.textContent = 'Gathering system information...\n';
  const info = await ipcRenderer.invoke('get-system-info');
  appendOutput(`Platform: ${info.platform}`);
  appendOutput(`Architecture: ${info.arch}`);
  appendOutput(`CPU cores: ${info.cpus}`);
  appendOutput(`Free memory: ${(info.freemem / 1024 / 1024).toFixed(2)} MB`);
  appendOutput(`Total memory: ${(info.totalmem / 1024 / 1024).toFixed(2)} MB`);
  appendOutput(`System uptime: ${(info.uptime / 3600).toFixed(2)} hours\n`);
});
