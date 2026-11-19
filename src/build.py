"""Inline the CSS and JS into one shareable HTML file: ../Slice-and-Score.html"""
import pathlib

d = pathlib.Path(__file__).parent
s = (d / "shell.html").read_text()
for tag, f in [("@@STYLE@@", "style.css"), ("@@ENGINE@@", "engine.js"),
               ("@@CONTENT@@", "content.js"), ("@@APP@@", "app.js")]:
    s = s.replace(tag, (d / f).read_text())
out = d.parent / "Slice-and-Score.html"
out.write_text(s)
# GitHub Pages serves docs/index.html
site = d.parent / "docs"
site.mkdir(exist_ok=True)
(site / "index.html").write_text(s)
print(out.name, "+ docs/index.html", f"{len(s):,} bytes")
