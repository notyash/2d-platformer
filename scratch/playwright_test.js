const { chromium } = require('playwright');
(async () => {
    console.log('Starting Playwright...');
    const browser = await chromium.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));

    console.log('Navigating to game...');
    await page.goto('http://localhost:5173');
    
    console.log('Waiting for game to load...');
    await page.waitForTimeout(2000);

    // Simulate pressing keys
    console.log('Simulating walk right...');
    await page.keyboard.down('d');
    await page.waitForTimeout(5000); // Walk right for 5 seconds to reach boss
    await page.keyboard.up('d');

    console.log('Simulating shoot...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(500);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(2000);

    await browser.close();
})();
