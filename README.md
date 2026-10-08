# 🎒 FUJA DA SOLANGE!! — Jogo de Suspense Escolar 2D

Jogo cooperativo de suspense e perseguição em 2D pixel art. Dois jogadores precisam cooperar para escapar de uma escola sombria vigiada por Solange. Suporta modo Solo/Offline imediato e modo cooperativo 2 jogadores com controle via Tablet/Celular.

---

## 🚀 Como Publicar no GitHub Pages sem Tela Branca

Este projeto já está **100% configurado** para o GitHub Pages. Você pode publicá-lo de **duas formas simples**:

### Opção 1: Automático via GitHub Actions (Recomendado)
1. Suba o código para o seu repositório no GitHub (`git push`).
2. No seu repositório no GitHub, clique em **Settings** (Configurações).
3. No menu lateral esquerdo, clique em **Pages**.
4. Em **Build and deployment** > **Source**, selecione:  
   👉 **GitHub Actions**
5. Pronto! O arquivo `.github/workflows/deploy.yml` já incluso compilará e publicará o jogo automaticamente a cada push.

---

### Opção 2: Direto pelo Branch (`main` / `/docs`)
1. Execute `npm run build` no seu computador (ele gera as pastas `dist/` e `docs/`).
2. Suba o código para o GitHub (`git add .`, `git commit -m "build"`, `git push`).
3. No GitHub, vá em **Settings** > **Pages**.
4. Em **Build and deployment** > **Source**, selecione **Deploy from a branch**.
5. No dropdown de pasta ao lado do branch `main`, selecione:  
   👉 **/docs**
6. Clique em **Save**. Em 1 minuto o site estará no ar funcionando perfeitamente!

---

## 🎮 Modos de Jogo

- **Modo Solo / Treino (Jogar Agora)**: Funciona diretamente no GitHub Pages sem precisar de backend ou servidor WebSocket.
- **Modo Cooperativo (2 Jogadores)**: Quando hospedado com o servidor Node/WebSocket (`npm start` ou servidor dedicado), permite criar salas de 6 dígitos e parear controles via QR Code no tablet/celular.
