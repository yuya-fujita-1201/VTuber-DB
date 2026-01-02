# GitHub Actions 自動デプロイ設定手順

このドキュメントでは、GitHub Actionsを使用してCloudflare WorkersとPagesを自動デプロイする設定手順を説明します。

## 前提条件

- GitHubリポジトリ: `yuya-fujita-1201/VTuber-DB`
- Cloudflareアカウント
- Cloudflare Workers と Pages のプロジェクトが作成済み

## 手順

### 1. Cloudflare API Tokenの取得

1. **Cloudflareダッシュボードにアクセス**
   - https://dash.cloudflare.com にログイン

2. **API Tokenページに移動**
   - 右上のプロフィールアイコン → 「My Profile」
   - 左メニューから「API Tokens」を選択

3. **新しいAPI Tokenを作成**
   - 「Create Token」ボタンをクリック
   - 「Edit Cloudflare Workers」テンプレートを選択
   - または、カスタムトークンで以下の権限を設定：
     - **Account** → **Cloudflare Pages** → **Edit**
     - **Account** → **Workers Scripts** → **Edit**
     - **Zone** → **Workers Routes** → **Edit**

4. **Account IDを確認**
   - Cloudflareダッシュボードのホーム画面
   - 右側のサイドバーに「Account ID」が表示されています
   - コピーして保存

### 2. GitHub Secretsの設定

1. **GitHubリポジトリにアクセス**
   - https://github.com/yuya-fujita-1201/VTuber-DB

2. **Settings → Secrets and variables → Actions**
   - リポジトリの「Settings」タブをクリック
   - 左メニューから「Secrets and variables」→「Actions」を選択

3. **以下のSecretsを追加**

   **CLOUDFLARE_API_TOKEN**
   - 「New repository secret」をクリック
   - Name: `CLOUDFLARE_API_TOKEN`
   - Secret: 手順1で取得したAPI Token
   - 「Add secret」をクリック

   **CLOUDFLARE_ACCOUNT_ID**
   - 「New repository secret」をクリック
   - Name: `CLOUDFLARE_ACCOUNT_ID`
   - Secret: 手順1で確認したAccount ID
   - 「Add secret」をクリック

### 3. デプロイのテスト

1. **GitHubにコードをpush**
   ```bash
   git add .
   git commit -m "Add GitHub Actions workflow"
   git push origin main
   ```

2. **GitHub Actionsの実行を確認**
   - GitHubリポジトリの「Actions」タブを開く
   - 「Deploy to Cloudflare」ワークフローが実行されていることを確認
   - 緑色のチェックマークが表示されれば成功

3. **デプロイされたサイトを確認**
   - Workers: https://vtuber-db.sam-y-1201.workers.dev
   - Pages: https://vtuber-db.pages.dev

## トラブルシューティング

### デプロイが失敗する場合

1. **API Tokenの権限を確認**
   - Workers Scripts: Edit
   - Cloudflare Pages: Edit
   - Workers Routes: Edit

2. **Account IDが正しいか確認**
   - Cloudflareダッシュボードで再度確認

3. **ワークフローログを確認**
   - GitHub Actionsの「Actions」タブで失敗したワークフローをクリック
   - エラーメッセージを確認

### 手動デプロイが必要な場合

```bash
# Workers
npx wrangler deploy

# Pages
cd frontend
npm run build
npx wrangler pages deploy dist --project-name=vtuber-db
```

## 今後の運用

- `main`ブランチにpushすると自動的にデプロイされます
- プルリクエストをマージすると自動デプロイが実行されます
- 手動でデプロイしたい場合は、GitHub Actionsの「Run workflow」ボタンから実行できます

## 参考リンク

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Pages Documentation](https://developers.cloudflare.com/pages/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Wrangler GitHub Action](https://github.com/cloudflare/wrangler-action)
