// Em builds fora do Windows o electron-builder não edita o .exe (sem Wine) e o aplicativo ficaria com o
// ícone padrão do Electron na barra de tarefas e nos atalhos. Grava aqui o ícone e os metadados.
const fs = require('node:fs');
const path = require('node:path');

exports.default = async function afterPack(context) {
  // Inventário dos arquivos que o instalador confere antes de desinstalar a versão antiga. Precisa ser refeito a CADA build:
  // sem isso o instalador usava uma lista velha (sem o suporte remoto, o telefone e a IA) e não percebia arquivos travados.
  await require('./installer-inventory.cjs')(context);
  if (process.platform === 'win32' || context.electronPlatformName !== 'win32') return;
  const ResEdit = (await import('resedit')).default || (await import('resedit'));
  const exePath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
  const resources = ResEdit.NtExecutableResource.from(exe);
  const icons = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(context.packager.projectDir, 'assets/icon.ico'))).icons.map((i) => i.data);
  const groups = ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries);
  if (!groups.length) throw new Error('O executável não possui grupo de ícones para substituir.');
  for (const group of groups) ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icons);
  const [info] = ResEdit.Resource.VersionInfo.fromEntries(resources.entries);
  if (info) {
    const version = context.packager.appInfo.version.split('.').map(Number);
    info.setFileVersion(version[0], version[1], version[2] || 0, 0, 1033);
    info.setProductVersion(version[0], version[1], version[2] || 0, 0, 1033);
    info.setStringValues({ lang: 1033, codepage: 1200 }, {
      FileDescription: context.packager.appInfo.productName,
      ProductName: context.packager.appInfo.productName,
      CompanyName: 'Acessanet Telecom LTDA',
    });
    info.outputToResourceEntries(resources.entries);
  }
  resources.outputResource(exe);
  fs.writeFileSync(exePath, Buffer.from(exe.generate()));
  console.log(`  • ícone e metadados gravados em ${path.basename(exePath)}`);
};
