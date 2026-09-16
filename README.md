# 拾知 - 运营岗位资质题库刷题平台

## 部署到 GitHub Pages

1. 在 GitHub 创建一个新仓库（如 `shizhi-quiz`）
2. 将本目录所有文件上传到仓库
3. 进入仓库 Settings > Pages
4. Source 选择 `main` 分支，文件夹选 `/ (root)`
5. 保存后等待几分钟，访问 `https://你的用户名.github.io/shizhi-quiz/` 即可

## 本地运行

```bash
cd 拾知目录
python3 -m http.server 8090
# 浏览器访问 http://localhost:8090
```

## 文件结构

```
index.html          入口页面
manifest.json       PWA 应用清单
css/themes.css      24种主题皮肤定义
css/app.css         核心样式
js/app.js           应用逻辑
data/questions.json 题库数据 (2957题)
data/meta.json      题库元数据
```

## 功能列表

- 顺序刷题 / 组卷刷题 / 按部门刷题
- 遗忘曲线记忆法 (SM-2 算法)
- 选题模式 (答题卡跳转)
- 循环刷题 (错题循环至掌握)
- 背题模式 / 闪卡记忆 / 游戏记忆
- 错题集 / 学习统计 / 30天活跃热力图
- 24种主题皮肤 + 自定义无极调色
- 答对/答错音效 (Web Audio API)
- 全平台响应式 (Windows / Android / iPhone)
```
