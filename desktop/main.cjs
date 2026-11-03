const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const base = path.resolve(__dirname, '..');
// Keep the portable edition's settings next to the application. In development
// all writable application state stays in this project, too.
const dataRoot = process.env.FLASH_DODGER_DATA || path.join(app.isPackaged ? path.dirname(process.execPath) : base, 'userdata');
fs.mkdirSync(dataRoot, { recursive:true });
app.setPath('userData', dataRoot);
app.setName('背闪训练器');
app.setAppUserModelId('local.flashdodger.trainer');
let window;
app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback) => callback(['pointerLock','fullscreen'].includes(permission)));
  session.defaultSession.setPermissionCheckHandler((_contents, permission) => ['pointerLock','fullscreen'].includes(permission));
  window = new BrowserWindow({
    width:1440,height:960,minWidth:1050,minHeight:740,title:'背闪训练器 · Flash Dodger',backgroundColor:'#10181e',
    autoHideMenuBar:true,show:false,
    webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false,webSecurity:true}
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label:'应用',submenu:[{label:'退出',role:'quit'}]},
    { label:'视图',submenu:[{label:'全屏',role:'togglefullscreen'}]}
  ]));
  window.webContents.setWindowOpenHandler(({url}) => {
    if(/^https:\/\/(playvalorant\.com|wiki\.playvalorant\.com|developer\.mozilla\.org)\//.test(url))shell.openExternal(url);
    return {action:'deny'};
  });
  window.webContents.on('will-navigate',event=>event.preventDefault());
  window.webContents.setVisualZoomLevelLimits(1,1);
  window.once('ready-to-show',()=>window.show());
  window.loadFile(path.join(base,'dist','index.html'));
});
app.on('window-all-closed',()=>app.quit());
