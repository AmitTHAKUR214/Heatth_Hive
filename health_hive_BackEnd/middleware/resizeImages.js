import sharp from "sharp";
import fs from "fs";
import path from "path";

export const resizePostImages = async (req, res, next) => {
  if (!req.files || req.files.length === 0) return next();

  try {
    await Promise.all(
      req.files.map(async (file) => {
        // skip webp — sharp sometimes hangs on webp
        if (file.mimetype === "image/webp") return;

        const outputPath = file.path.replace(/\.[^.]+$/, "-compressed.jpg");

        await sharp(file.path)
          .resize({ width: 1280 })
          .jpeg({ quality: 70 })
          .toFile(outputPath);

        fs.unlinkSync(file.path);
        file.path = outputPath;
        file.filename = path.basename(outputPath);
      })
    );

    next();
  } catch (err) {
    console.error("Image resize failed:", err.message);
    res.status(500).json({ message: "Image processing failed" });
  }
};