import asyncio
from playwright.async_api import async_playwright
import os

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()
        cwd = os.getcwd()
        await page.goto(f"file://{cwd}/index.html")
        await page.wait_for_timeout(1000)

        # Click the play button
        await page.click("#btnPlay")
        await page.wait_for_timeout(1000)

        # Click the sector 1 button
        await page.click(".sector-btn")
        await page.wait_for_timeout(2000)

        # Press M to open shop
        await page.keyboard.press("m")
        await page.wait_for_timeout(1000)

        # scroll the shop items to bottom
        await page.evaluate("document.querySelector('.shop-items').scrollTop = document.querySelector('.shop-items').scrollHeight")
        await page.wait_for_timeout(1000)

        await page.screenshot(path="final_shop_scroll.png")
        await browser.close()

asyncio.run(run())
