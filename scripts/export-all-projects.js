const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function exportProject(projectName) {
  const projectPath = path.join(__dirname, '..', 'projects', projectName);
  const exportScript = path.join(projectPath, 'export-all.js');
  
  if (!fs.existsSync(exportScript)) {
    console.log(`❌ مشروع ${projectName} لا يحتوي على سكريبت export-all.js`);
    return false;
  }
  
  console.log(`🚀 بدء تصدير مشروع: ${projectName}`);
  
  try {
    // تثبيت التبعيات أولاً
    console.log(`📦 تثبيت التبعيات لـ ${projectName}...`);
    await execAsync('npm install', { cwd: projectPath });
    
    // تشغيل سكريبت التصدير
    console.log(`🖼️  تصدير الشرائح لـ ${projectName}...`);
    const { stdout, stderr } = await execAsync('node export-all.js', { cwd: projectPath });
    
    if (stdout) console.log(stdout);
    if (stderr) console.error(stderr);
    
    console.log(`✅ تم تصدير مشروع ${projectName} بنجاح`);
    return true;
  } catch (error) {
    console.error(`❌ فشل تصدير مشروع ${projectName}:`, error.message);
    return false;
  }
}

async function main() {
  const projectsDir = path.join(__dirname, '..', 'projects');
  
  if (!fs.existsSync(projectsDir)) {
    console.log('❌ مجلد المشاريع غير موجود');
    return;
  }
  
  const projects = fs.readdirSync(projectsDir).filter(item => {
    const itemPath = path.join(projectsDir, item);
    return fs.statSync(itemPath).isDirectory();
  });
  
  if (projects.length === 0) {
    console.log('❌ لا توجد مشاريع للتصدير');
    return;
  }
  
  console.log(`📁 العثور على ${projects.length} مشروع(ات): ${projects.join(', ')}`);
  
  const results = [];
  for (const project of projects) {
    const success = await exportProject(project);
    results.push({ project, success });
    
    // انتظار قصير بين المشاريع
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n📊 ملخص النتائج:');
  console.log('='.repeat(40));
  
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ ناجحة: ${successful}`);
  console.log(`❌ فاشلة: ${failed}`);
  
  if (failed > 0) {
    console.log('\nالمشاريع الفاشلة:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`  - ${r.project}`);
    });
  }
  
  console.log('\n🎉 تم الانتهاء من عملية التصدير!');
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { exportProject, main };