Vou ajustar apenas o cabeçalho da sidebar em `src/components/AppSidebar.tsx`.

Plano:
1. Manter o mesmo arquivo oficial já usado no login: `src/assets/logo-pelove.png`.
2. Trocar o dimensionamento atual (`h-10 w-auto`), que deixa a imagem minúscula porque o PNG tem muita área transparente, por largura controlada no header expandido (`w-[150px]`/similar) com `h-auto` e `object-contain`.
3. Manter o link para `/mapa`, o botão de tema, os itens de menu e o botão “Sair” exatamente como estão.
4. No estado recolhido, manter uma versão pequena do logo, mas com tamanho suficiente para aparecer melhor dentro da largura da sidebar.
5. Validar visualmente no preview que o badge “PE” não aparece e que o logo oficial está visível no cabeçalho.