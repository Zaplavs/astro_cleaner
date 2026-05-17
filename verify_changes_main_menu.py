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

        await page.screenshot(path="final_main_menu.png")
        await browser.close()

asyncio.run(run())
