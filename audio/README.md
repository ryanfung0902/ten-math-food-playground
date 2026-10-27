# 廣東話數數配音

網站預設播放 `ying-wah/count-1.wav` 至 `ying-wah/count-10.wav`（陳映華老師）。
切換至陳詠婷老師時，`wing-ting/count-1.wav` 至 `wing-ting/count-3.wav`
採用老師提供的原錄音；四至十仍播放陳映華老師的配音，畫面亦有註明。

陳映華老師的一至三及陳詠婷老師的一至三，均從各自提供的錄音剪出。
陳映華老師的四至十以其錄音作參考，使用本機運行的
[`Ming-3.0-tts-0.5B`](https://huggingface.co/mlx-community/Ming-3.0-tts-0.5B-bf16)
生成，再逐個剪輯。模型以 MIT 授權。這七段是合成延伸聲音，並非老師親自錄製。

根目錄的 `count-1.wav` 至 `count-10.wav` 是舊版 `canto-tts` 配音，
目前介面不再使用。
