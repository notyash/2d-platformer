const puppeteer = require('puppeteer');
(async () => {
    console.log('Starting Puppeteer...');
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    console.log('Navigating to game...');
    await page.goto('http://localhost:5173');
    
    console.log('Waiting for game to load...');
    await new Promise(r => setTimeout(r, 2000));

    console.log('Simulating walk right...');
    await page.keyboard.down('d');
    await new Promise(r => setTimeout(r, 5000)); // Walk right for 5 seconds to reach boss
    await page.keyboard.up('d');

    console.log('Simulating shoot...');
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 500));
    await page.keyboard.press('Enter');
    await new Promise(r => setTimeout(r, 2000));

    await browser.close();
})();
