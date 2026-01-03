# GitHubアクション デプロイエラー修正ガイド

## 問題の概要

GitHubアクションで`Deploy to Cloudflare`が失敗し続けています。

## エラー内容

```
Error: The process '/opt/hostedtoolcache/node/20.19.6/x64/bin/npx' failed with exit code 1
Error: 🚨 Action failed
```

## 根本原因

`cloudflare/wrangler-action@v3`が内部で`npx wrangler deploy`を実行する際に、環境変数やCloudflare APIの認証に失敗している可能性があります。

## 修正方法

### オプション1: ワークフローファイルを手動で修正（推奨）

`.github/workflows/deploy.yml`を以下のように修正してください：

**変更前**:
```yaml
- name: Deploy to Cloudflare Workers
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: deploy
```

**変更後**:
```yaml
- name: Deploy to Cloudflare Workers
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: npx wrangler deploy
```

同様に、`Deploy to Cloudflare Pages`ステップも修正：

**変更前**:
```yaml
- name: Deploy to Cloudflare Pages
  uses: cloudflare/wrangler-action@v3
  with:
    apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
    command: pages deploy frontend/dist --project-name=vtuber-db
```

**変更後**:
```yaml
- name: Deploy to Cloudflare Pages
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: npx wrangler pages deploy frontend/dist --project-name=vtuber-db
```

### オプション2: 完全な修正版ワークフローファイル

`deploy.yml.proposed`ファイルに完全な修正版があります。このファイルを`.github/workflows/deploy.yml`にコピーしてください。

```bash
cp deploy.yml.proposed .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "fix: GitHubアクションのデプロイエラーを修正"
git push origin main
```

## 修正後の確認

1. GitHubリポジトリの「Actions」タブを開く
2. 最新のワークフロー実行を確認
3. 「Deploy Workers」と「Deploy Pages」が成功することを確認

## トラブルシューティング

### それでも失敗する場合

1. **Cloudflare API Tokenの権限を確認**
   - Cloudflareダッシュボード → My Profile → API Tokens
   - 必要な権限: Workers Scripts:Edit, Account Settings:Read, D1:Edit, Pages:Edit

2. **Account IDを確認**
   - Cloudflareダッシュボード → Workers & Pages
   - 右側のサイドバーに表示されているAccount IDを確認

3. **GitHubシークレットを再設定**
   - GitHubリポジトリ → Settings → Secrets and variables → Actions
   - `CLOUDFLARE_API_TOKEN`と`CLOUDFLARE_ACCOUNT_ID`を削除して再作成

## 参考情報

- [Cloudflare Wrangler Action](https://github.com/cloudflare/wrangler-action)
- [Wrangler CLI Documentation](https://developers.cloudflare.com/workers/wrangler/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
