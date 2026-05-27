# Reels Layout Notes

For detailed tuning steps, use:

- `docs/reels-layout-tuning.txt`

## Decrease Commander Panel Width

Use `styles.css` and adjust `.reels-commanders`:

```css
.reels-commanders {
  padding: 8px 72px 18px;
}
```

- Increasing the horizontal padding value (`72px` above) makes both commander panels narrower.
- Decreasing it makes both panels wider.

Secondary width control is `.reels-commander`:

```css
.reels-commander {
  grid-template-columns: 132px 1fr;
}
```

- Increasing `132px` reserves more room for portrait and shrinks text column.
- Decreasing it gives more room to text column.
