const fs = require('node:fs');
const yaml = require('js-yaml');
const config = yaml.load(fs.readFileSync(require('node:path').join(__dirname, 'electron-builder.yml'), 'utf8'));
const feed = process.env.WORKSPACE_UPDATE_URL;
const publisher = process.env.WORKSPACE_UPDATE_PUBLISHER;
const release = process.env.WORKSPACE_RELEASE === '1';
// Sem publicador, o canal é o servidor interno cujo certificado está fixado no app (electron/updateDeployment.ts).
const pinnedOrigin = /updateOrigin = "([^"]+)"/.exec(fs.readFileSync(require('node:path').join(__dirname, 'electron/updateDeployment.ts'), 'utf8'))[1];
if (publisher && !feed) throw new Error('WORKSPACE_UPDATE_PUBLISHER exige WORKSPACE_UPDATE_URL.');
const signed = Boolean(publisher);
if (release && !feed) throw new Error('Release exige WORKSPACE_UPDATE_URL.');
if (release && signed && !(process.env.CSC_LINK || process.env.WIN_CSC_LINK))
  throw new Error('Release assinada exige credenciais de assinatura no ambiente.');
config.publish = null;
config.afterPack = require('node:path').join(__dirname, 'scripts/after-pack-icon.cjs');
if (feed) {
  const url = new URL(feed);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('O canal de atualização exige HTTPS sem credenciais na URL.');
  if (!signed && url.origin !== pinnedOrigin)
    throw new Error('Sem assinatura, o canal deve ser ' + pinnedOrigin + '.');
  config.publish = [{ provider: 'generic', useMultipleRangeRequest: false, url: url.href.endsWith('/') ? url.href : url.href + '/' }];
  if (signed) {
    config.win.signtoolOptions = { publisherName: publisher };
    config.win.verifyUpdateCodeSignature = true;
    // Um build assinado nunca pode criar uma entrega sem assinatura.
    config.forceCodeSigning = true;
  }
}
// App de TESTES: instalado ao lado do oficial, com nome, chaves de registro e executável próprios.
if (process.env.WORKSPACE_AMBIENTE === 'teste') {
  const path = require('node:path');
  if (!feed || !/\/windows\/pilot\/?$/.test(feed)) throw new Error('O app de testes só pode usar o canal /windows/pilot/.');
  const dir = path.join(__dirname, 'build', 'teste');
  fs.mkdirSync(dir, { recursive: true });
  const trocar = (texto) => texto
    .replaceAll('Acessa Workspace.exe', 'Acessa Workspace Teste.exe')
    .replaceAll('Software\\AcessaWorkspace', 'Software\\AcessaWorkspaceTeste')
    .replaceAll('Uninstall\\AcessaWorkspace', 'Uninstall\\AcessaWorkspaceTeste')
    .replaceAll('Acessa Workspace', 'Acessa Workspace Teste')
    .replaceAll('Acessa Workspace Teste Teste', 'Acessa Workspace Teste')
    .replace('${PROJECT_DIR}/assets/prepare-update.ps1', dir.replaceAll('\\', '/') + '/prepare-update.ps1');
  fs.writeFileSync(path.join(dir, 'installer.nsh'), trocar(fs.readFileSync(path.join(__dirname, 'assets/installer.nsh'), 'utf8')));
  fs.writeFileSync(path.join(dir, 'prepare-update.ps1'), trocar(fs.readFileSync(path.join(__dirname, 'assets/prepare-update.ps1'), 'utf8')));
  config.appId = 'br.com.acessanet.workspace.teste';
  config.productName = 'Acessa Workspace Teste';
  config.nsis.include = path.join(dir, 'installer.nsh');
  config.nsis.menuCategory = 'Acessa Workspace Teste';
  config.portable.artifactName = 'AcessaWorkspaceTeste-Portable.exe';
  config.directories = { ...config.directories, output: 'release-teste' };
}
module.exports = config;
