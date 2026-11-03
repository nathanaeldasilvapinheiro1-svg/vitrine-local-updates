# Atualizações oficiais — Vitrine Local

Este repositório **público** distribui versões dos aplicativos, sem publicar código-fonte privado ou chaves de assinatura.

## Vitrine Local Entregador

- Canal de versões: [Releases](../../releases)
- Manifesto lido pelo aplicativo: [entregador/manifest.json](entregador/manifest.json)
- Automação: [.github/workflows/sincronizar-entregador.yml](.github/workflows/sincronizar-entregador.yml)

### Publicação de uma versão

A publicação de uma Release do Entregador dispara um fluxo que **valida o APK e atualiza automaticamente o manifesto**, sem editar o JSON manualmente.

Formato exigido da Release:

- Tag: `entregador-v0.1.04` (incrementar a versão a cada publicação).
- APK assinado em anexo: `VitrineLocalEntregador0104.apk` (mesma versão que a tag).
- Notas de versão: itens com **nome da área: descrição da melhoria**. Exemplo:

```text
- Entregas: Melhorias na retirada e confirmação do pedido.
- GPS e Mapa: Ajustes na navegação pelos estabelecimentos e clientes.
```

O fluxo verifica o nome do arquivo, o identificador do pacote Android, a versão e o `versionCode`, calcula o SHA-256 do APK e só então atualiza `entregador/manifest.json`.

**Não atualizar o manifesto antes de o APK estar publicado e validado.** O aviso no aplicativo deve surgir apenas quando a versão do manifesto for superior à versão instalada.

### Publicação sem intervenção manual

Para que nem a Release precise ser enviada manualmente, ainda será necessário conectar um processo de compilação e assinatura em um projeto **privado**, usando segredos protegidos do GitHub Actions, e autorizar esse processo a publicar no repositório público.

Nenhum token de acesso, certificado de assinatura ou senha deve ser enviado para este repositório.
