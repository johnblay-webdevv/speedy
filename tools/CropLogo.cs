using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;

public static class LogoCrop {
  public static string Run(string src, string dest) {
    using (var raw = new Bitmap(src)) {
      int w = raw.Width;
      int h = raw.Height;
      using (var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb)) {
        using (var g = Graphics.FromImage(bmp)) {
          g.DrawImage(raw, 0, 0, w, h);
        }
        int minX = w, minY = h, maxX = -1, maxY = -1;
        for (int y = 0; y < h; y++) {
          for (int x = 0; x < w; x++) {
            Color c = bmp.GetPixel(x, y);
            if (c.A > 16 && (c.R < 246 || c.G < 246 || c.B < 246)) {
              if (x < minX) minX = x;
              if (y < minY) minY = y;
              if (x > maxX) maxX = x;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < 0) {
          minX = 0;
          minY = 0;
          maxX = w - 1;
          maxY = h - 1;
        }
        int pad = 8;
        minX = Math.Max(0, minX - pad);
        minY = Math.Max(0, minY - pad);
        maxX = Math.Min(w - 1, maxX + pad);
        maxY = Math.Min(h - 1, maxY + pad);
        int cw = maxX - minX + 1;
        int ch = maxY - minY + 1;
        int side = Math.Max(cw, ch);
        using (var square = new Bitmap(side, side, PixelFormat.Format32bppArgb)) {
          using (var g2 = Graphics.FromImage(square)) {
            g2.Clear(Color.Transparent);
            g2.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g2.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g2.DrawImage(
              bmp,
              new Rectangle((side - cw) / 2, (side - ch) / 2, cw, ch),
              new Rectangle(minX, minY, cw, ch),
              GraphicsUnit.Pixel
            );
          }
          using (var icon = new Bitmap(512, 512, PixelFormat.Format32bppArgb)) {
            using (var g3 = Graphics.FromImage(icon)) {
              g3.InterpolationMode = InterpolationMode.HighQualityBicubic;
              g3.PixelOffsetMode = PixelOffsetMode.HighQuality;
              g3.Clear(Color.Transparent);
              g3.DrawImage(square, 0, 0, 512, 512);
            }
            icon.Save(dest, ImageFormat.Png);
          }
        }
        return w + "x" + h + " -> " + cw + "x" + ch;
      }
    }
  }
}
