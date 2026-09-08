import json
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
import time

# Create a clean html file
with open('dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()
import re
html = re.sub(r'<script.*?</script>', '', html, flags=re.DOTALL)
with open('test.html', 'w', encoding='utf-8') as f:
    f.write(html)

options = Options()
options.add_argument('--headless')
options.add_argument('--window-size=390,844')

driver = webdriver.Chrome(options=options)
driver.get("http://127.0.0.1:8080/test.html")

time.sleep(1)

driver.execute_script("""
    document.querySelectorAll('.view').forEach(e => e.hidden = true);
    document.getElementById('view-asistencia').hidden = false;
    document.body.setAttribute('data-time-phase', 'night');
    document.querySelector('.portal').setAttribute('data-time-phase', 'night');
    document.querySelector('.portal').setAttribute('data-personal', 'true');
    document.querySelector('.portal').setAttribute('data-view', 'asistencia');
""")
time.sleep(1)

elements = [
    "#view-asistencia",
    "#view-asistencia .view-head",
    ".attendance-topbar",
    "#attendance-stats",
    ".attendance-workspace",
    ".attendance-request-center",
    ".attendance-calendar",
    ".time-ambience-orb"
]

results = {}
for selector in elements:
    try:
        el = driver.find_element("css selector", selector)
        rect = el.rect
        css_display = el.value_of_css_property("display")
        results[selector] = {
            "y": rect["y"], "height": rect["height"], "display": css_display
        }
    except Exception as e:
        results[selector] = "Not found or error"

with open("layout.json", "w") as f:
    json.dump(results, f, indent=2)

driver.quit()
