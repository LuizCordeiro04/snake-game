# Snake

Jogo da cobrinha em um tabuleiro fixo de 22 x 22, com passagem pelas bordas, comida comum e comida dourada. Jogar sem conta continua permitido, com recorde salvo neste navegador. A conta usa Supabase Auth e exibe o nickname do perfil.

## Tecnologias

HTML, CSS e JavaScript puro, com supabase-js v2 para autenticacao. O jogo continua estatico; cadastro e login precisam de internet. Para testar os links de e-mail, use a URL publicada no GitHub Pages. Abrir `index.html` localmente continua permitindo jogar, mas redirecionamentos de autenticacao nao devem usar `file://`.

## Conta

O frontend usa apenas Project URL e publishable key em `js/supabase-config.js`. Nunca coloque secret key, service_role ou senhas neste diretorio. O cadastro envia o nickname para o trigger que cria `player_profiles`; o frontend apenas le esse perfil. Ao terminar uma partida autenticada, o resultado e enviado pela Edge Function `submit-score`. Jogar sem conta mantem apenas o recorde local. O ranking ainda nao faz parte desta versao.

## Controles

- PC: setas ou WASD para mover; Esc para pausar ou continuar.
- Celular e tablet: deslize o dedo para mudar a direcao; use o botao de pausa na tela.
