const { execSync } = require('child_process');
const patterns = [
  'aksharaintern123',
  'postgres.msfnajafbdmjixbqqhvn',
  'sk_live_',
  'sk_test_',
];

console.log('=== HEAD working tree scan ===');
for (const p of patterns) {
  try {
    const out = execSync(`git grep -n ${JSON.stringify(p)} -- .`, {
      encoding: 'utf8',
      cwd: require('path').join(__dirname, '..', '..'),
    });
    console.log('HIT', p);
    console.log(out.slice(0, 800));
  } catch {
    console.log('NO_HIT_HEAD', p);
  }
}

console.log('=== recent commit content scan (last 80 commits) ===');
try {
  const revs = execSync('git rev-list -n 80 HEAD', {
    encoding: 'utf8',
    cwd: require('path').join(__dirname, '..', '..'),
  })
    .trim()
    .split(/\r?\n/);
  for (const p of patterns) {
    let hits = 0;
    for (const rev of revs) {
      try {
        const out = execSync(`git grep -n ${JSON.stringify(p)} ${rev}`, {
          encoding: 'utf8',
          cwd: require('path').join(__dirname, '..', '..'),
        });
        if (out.trim()) {
          hits += 1;
          if (hits <= 3) console.log('HIT_REV', p, rev.slice(0, 8), out.split(/\r?\n/)[0]);
        }
      } catch {
        // no match in that revision
      }
    }
    if (hits === 0) console.log('NO_HIT_HISTORY', p);
    else console.log('TOTAL_REVS_WITH_HIT', p, hits);
  }
} catch (e) {
  console.error(e.message);
}
