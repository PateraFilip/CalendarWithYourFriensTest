const fs = require('fs');
const path = require('path');

const moveMap = {
  'cancel_event.ts': 'events',
  'create_event.ts': 'events',
  'create_exception.ts': 'events',
  'delete_event.ts': 'events',
  'getUserEvents.ts': 'events',
  'get_event_exceptions.ts': 'events',
  'get_events.ts': 'events',
  'join_event.ts': 'events',
  'update_event.ts': 'events',
  
  'get_colors.ts': 'users',
  'get_users.ts': 'users',
  'update_color.ts': 'users',
  'update_user.ts': 'users',
  
  'friendships.ts': 'friends',
  
  'leagues.ts': 'leagues',
  'submit_match.ts': 'leagues',
  
  'send_system_message.ts': 'system',
  'supabaseClient.ts': 'system'
};

const apiDir = path.join(__dirname, '../api');

// Create directories
const dirs = [...new Set(Object.values(moveMap))];
dirs.forEach(dir => {
  const dirPath = path.join(apiDir, dir);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath);
  }
});

// Move files
for (const [file, folder] of Object.entries(moveMap)) {
  const oldPath = path.join(apiDir, file);
  const newPath = path.join(apiDir, folder, file);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
  }
}

// Global replacement mapping
const replacements = Object.entries(moveMap).map(([file, folder]) => {
  const name = file.replace('.ts', '');
  return {
    old: `api/${name}`,
    new: `api/${folder}/${name}`
  };
});

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        processDirectory(fullPath);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let changed = false;
      
      for (const { old: oldPath, new: newPath } of replacements) {
        // Replace absolute alias paths @/api/...
        const oldName = oldPath.split('/')[1];
        const newRoute = newPath.split('/').slice(1).join('/'); // events/create_event
        
        const regex1 = new RegExp(`@/api/${oldName}(?=['"])`, 'g');
        if (regex1.test(content)) {
          content = content.replace(regex1, `@/api/${newRoute}`);
          changed = true;
        }

        // Replace relative paths from api directory
        if (fullPath.includes(path.normalize('api/'))) {
            const regex2 = new RegExp(`(?<=from\\s*['"])(\\.\\/|\\.\\.\\/)${oldName}(?=['"])`, 'g');
            if (regex2.test(content)) {
                content = content.replace(regex2, `@/api/${newRoute}`);
                changed = true;
            }
        }
      }

      if (changed) {
        fs.writeFileSync(fullPath, content);
      }
    }
  }
}

processDirectory(path.join(__dirname, '..'));
console.log('Reorganization complete.');
