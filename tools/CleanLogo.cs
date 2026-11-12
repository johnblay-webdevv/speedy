using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Imaging;

public static class CleanLogo {
  public static string Run(string path) {
    using (var raw = new Bitmap(path)) {
      int w = raw.Width, h = raw.Height;
      var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
      using (var g = Graphics.FromImage(bmp)) g.DrawImage(raw, 0, 0, w, h);
      bool[,] kill = new bool[w, h];
      var queue = new Queue<Point>();
      for (int x = 0; x < w; x++) { queue.Enqueue(new Point(x, 0)); queue.Enqueue(new Point(x, h - 1)); }
      for (int y = 0; y < h; y++) { queue.Enqueue(new Point(0, y)); queue.Enqueue(new Point(w - 1, y)); }
      bool[,] seen = new bool[w, h];
      while (queue.Count > 0) {
        var p = queue.Dequeue();
        if (p.X < 0 || p.Y < 0 || p.X >= w || p.Y >= h || seen[p.X, p.Y]) continue;
        seen[p.X, p.Y] = true;
        Color c = bmp.GetPixel(p.X, p.Y);
        bool light = c.A < 20 || (c.R > 210 && c.G > 210 && c.B > 210);
        if (!light) continue;
        kill[p.X, p.Y] = true;
        queue.Enqueue(new Point(p.X + 1, p.Y));
        queue.Enqueue(new Point(p.X - 1, p.Y));
        queue.Enqueue(new Point(p.X, p.Y + 1));
        queue.Enqueue(new Point(p.X, p.Y - 1));
      }
      for (int y = 0; y < h; y++) {
        for (int x = 0; x < w; x++) {
          if (!kill[x, y]) continue;
          bmp.SetPixel(x, y, Color.Transparent);
        }
      }
      raw.Dispose();
      bmp.Save(path, ImageFormat.Png);
      bmp.Dispose();
      return "cleaned";
    }
  }
}
