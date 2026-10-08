# 音乐来源

Ghuzheng Fantasie — neolein (voices of oblivion)
Freesound #541306；作者发布许可：Creative Commons CC0 1.0

- 作品与作者页：https://freesound.org/people/neolein/sounds/541306/
- CC0说明：https://creativecommons.org/publicdomain/zero/1.0/
- 使用作者页面公开提供的MP3预览，内嵌于网页；调整音量，并为循环起止添加淡入淡出
- 原公开预览：https://cdn.freesound.org/previews/541/541306_4596312-lq.mp3

网页没有外链音频请求。此处准确记录作者发布的许可，不将第三方录音声称为原创。

构建输出没有运行时第三方JavaScript依赖。开发测试依赖的许可证由 npm 安装的对应软件包提供。

## 文化页生成素材

三幅透明背景插图为本项目通过图像生成工具生成的材料示意，保存在 src/assets/intro/。无损 WebP 与原始 PNG 的 RGBA 像素一致，不依赖第三方图片 CDN。图中工具、染材与织物用于视觉介绍，不构成历史真实性鉴定。


## v10 界面图标与字体

Phosphor Icons 官方 core 仓库（MIT）：https://github.com/phosphor-icons/core 。
实际使用的 11 枚 regular SVG 保存在 src/assets/icons，完整许可保存在同目录 LICENSE。构建内嵌 symbol，不发起 CDN 请求。
字体使用系统中可用的 Noto Sans SC、HarmonyOS Sans SC、PingFang SC、Microsoft YaHei，按顺序回退；本交付没有复制或嵌入第三方字体文件。Noto Sans SC 参考：https://fonts.google.com/noto/specimen/Noto+Sans+SC 。

工坊线稿、方巾和淡织物底纹由内置 ImageGen 生成，为本项目原创示意资产；生成提示及元数据记录在 ../过程性文件/v10-assets-hero.md、v10-assets-handkerchief.md、v10-assets-texture.md。页面使用同尺寸 WebP 压缩版，工坊黑色透明线稿通过 CSS filter 显示为白线。用户提供的三张截图仅作为风格参考，未复制品牌、吉祥物或商业文案。
