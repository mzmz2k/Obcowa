/* 依存ライブラリのライセンス全文を収集し、THIRD_PARTY_LICENSES.txt を自動生成するスクリプト
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. スクリプトの置き場所（/scripts）を基準に、プロジェクトルートの絶対パスを決定
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

export function generateThirdPartyLicenses() {
  // package.json のパスを絶対パスで指定
  const pkgPath = path.resolve(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const deps = Object.keys(pkg.dependencies || {});
  
  let output = `================================================================================
THIRD-PARTY SOFTWARE NOTICES AND INFORMATION
================================================================================
This software includes the third-party software components listed below.
Please see the individual sections for license terms and copyright notices.

`;

  // 1. npm ライブラリの走査
  for (const dep of deps) {
    try {
      // node_modules の位置もプロジェクトルート基準に統一
      const depPkgPath = path.resolve(projectRoot, 'node_modules', dep, 'package.json');
      if (!fs.existsSync(depPkgPath)) continue;

      const depPkg = JSON.parse(fs.readFileSync(depPkgPath, 'utf8'));
      const depDir = path.dirname(depPkgPath);
      
      // LICENSE / LICENCE ファイルを探す
      const files = fs.readdirSync(depDir);
      const licenseFile = files.find(f => /^licen[sc]e/i.test(f));

      const author = typeof depPkg.author === 'string' 
        ? depPkg.author 
        : depPkg.author?.name || 'Contributors';

      output += `--------------------------------------------------------------------------------\n`;
      output += `Package: ${dep} (v${depPkg.version})\n`;
      output += `License: ${depPkg.license || 'See below'}\n`;
      output += `Author:  ${author}\n`;
      output += `--------------------------------------------------------------------------------\n\n`;

      if (licenseFile) {
        output += fs.readFileSync(path.join(depDir, licenseFile), 'utf8').trim() + '\n\n\n';
      } else {
        output += `(License text not found in package directory)\n\n\n`;
      }
    } catch (e) {
      console.warn(`Could not read license for ${dep}:`, e.message);
    }
  }

  // 2. Tauri / Rust 側の主要クレートのライセンスを追記
  output += `--------------------------------------------------------------------------------\n`;
  output += `Package: Tauri Framework & Plugins\n`;
  output += `License: MIT or Apache-2.0\n`;
  output += `Author:  Tauri Programme within The Commons Conservancy\n`;
  output += `--------------------------------------------------------------------------------\n`;
  output += `Copyright 2019-present Tauri Programme within The Commons Conservancy

Licensed under the Apache License, Version 2.0 or the MIT license,
at your option. This file may not be copied, modified, or distributed
except according to those terms.\n\n\n`;

  output += `--------------------------------------------------------------------------------\n`;
  output += `Package: encoding_rs\n`;
  output += `License: Apache-2.0 or MIT\n`;
  output += `Author:  Henri Sivonen & Mozilla Foundation\n`;
  output += `--------------------------------------------------------------------------------\n`;
  output += `Copyright 2015-2016 Mozilla Foundation & Henri Sivonen

Licensed under the Apache License, Version 2.0 or the MIT license,
at your option. This file may not be copied, modified, or distributed
except according to those terms.\n\n`;

  // プロジェクトルート直下に THIRD_PARTY_LICENSES.txt を書き出し
  const outputPath = path.resolve(projectRoot, 'THIRD_PARTY_LICENSES.txt');
  fs.writeFileSync(outputPath, output, 'utf8');
  console.log(`Generated: ${outputPath}`);
}

// コマンドラインから直接実行された際に動作させるための呼び出し
generateThirdPartyLicenses();