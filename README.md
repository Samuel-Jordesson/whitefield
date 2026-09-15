# WHITEFIELD — FPS online 3D com sprites 2D

Mundo 3D (Three.js) em campo aberto branco, primeira pessoa sem corpo visivel,
arma de tela usando `arma.png` e todo o resto — cenario e jogadores — feito de
**sprites 2D** em billboard: planos que sempre encaram a camera e projetam
sombra recortada pelo alpha da textura.

Agora e **online**: um servidor Node cria salas com codigo, os jogadores entram
pelo IP da maquina na mesma rede, escolhem o personagem e se enfrentam.

## Rodar

```bash
./run.sh
# ou
npm start
```

O servidor escreve os enderecos no terminal:

```
  nesta maquina:  http://localhost:3000
  na rede local:  http://192.168.x.x:3000
```

Quem for jogar junto abre **o endereco da rede local** no navegador — nao precisa
configurar nada, o jogo conversa com o servidor no mesmo host/porta da pagina.
Para trocar a porta: `PORT=8080 node server.js`.

## Menu inicial

Abrindo o jogo voce cai no menu, no estilo dos Call of Duty: a lista de abas na
lateral com um degrade saindo da esquerda e a arte de fundo (`fundo1.jpeg`) atras.
**Cada aba abre como uma pagina inteira** (o menu lateral sai da frente), com um
botao VOLTAR — igual ao painel de configuracoes da pausa.

No alto ficam **seu nome** (da para editar ali mesmo), o **nivel** com a barra de
XP e as **moedas**.

| Aba | O que faz |
|---|---|
| JOGAR SOLO | escolhe o operador e comeca uma partida contra bots |
| ENTRAR SALA | campo para colar o codigo da sala |
| CRIAR SALA | cria a sala e leva voce para o lobby com o codigo |
| PLANO DE FUNDO | escolhe a arte do menu (por enquanto so uma) |
| OPERADOR | escolhe/compra o personagem que vai para a partida |
| LOJA | skins de arma, acessorios e itens (alguns marcados "em breve") |
| CONFIGURACOES | grafico e controles, tudo mexendo no jogo de verdade |

### Nivel e moedas

- **1 moeda por abate**; ganhando a partida o valor **dobra**.
- **Perdendo, voce nao leva nada do que juntou** naquela partida — mas o que ja
  tinha antes continua intacto.
- XP: 12 por abate, mais 80 por vitoria ou 25 por participar. Cada nivel pede um
  pouco mais de XP que o anterior.
- Tudo fica salvo no navegador (localStorage). Duas abas no mesmo navegador
  dividem o mesmo perfil — para testar dois perfis, use navegadores diferentes
  ou uma janela anonima.

### Configuracoes

As mesmas configuracoes aparecem no menu inicial e no **ESC durante a partida**
(botao CONFIGURACOES) — mudou ali, vale na hora, sem sair do jogo.

| Opcao | O que muda de verdade |
|---|---|
| Distancia da grama | baixa (46 m / 6 mil tufos), media (96 m / 17 mil), alta (260 m / 60 mil — o mapa todo) |
| Resolucao | escala de renderizacao: 60%, 80%, 100% ou 2x |
| Qualidade das texturas | anisotropia das texturas (1, 4 ou 16) |
| Sombras | desligadas ou shadow map de 1024 / 2048 / 4096 |
| Distancia de visao | onde a neblina fecha o cenario (120, 190 ou 300 m) |
| Campo de visao | FOV de 70 a 95 |
| Sensibilidade do mouse | quatro niveis |

## Modo historia

Aba **MODO HISTORIA** no menu. Roda inteiro na sua maquina (nao precisa de
servidor) e usa o operador escolhido como protagonista.

### Fase 1 — A Subida

Tres da manha. Invadiram o seu predio e o unico caminho e **para cima**: chegar
ao helicoptero no terraco.

1. **Cinematica de abertura** (ESPACO duas vezes pula): a camera vem da rua,
   entra pela janela do quarto, fecha no computador com o alerta de invasao, a
   porta do predio e arrombada (a camera treme e as luzes do corredor apagam),
   espia os invasores chegando pelo corredor e termina na faca em cima do criado-
   mudo. A camera desce para os olhos do personagem e o jogo comeca **so com a faca**.
2. **Andar 0** — quarto com cama desfeita, escrivaninha, guarda-roupa, poster,
   banheiro. Porta aberta para o corredor: carpete, luminarias (uma piscando),
   elevador arrombado, lavanderia e apartamentos 33, 34 e 36 com invasores. O
   primeiro esta de costas: chegue andando e **faca pelas costas mata na hora**
   (abate silencioso) — e ele larga a pistola na lapide.
3. **Escada leste** sobe ao andar 1, mas o teto dela desabou logo acima.
4. **Andar 1** — o corredor tambem desabou no meio. A rota e por dentro: entra
   no **apartamento 46** (arrombado), atravessa a sala e passa por um **buraco na
   parede** para o 45, que sai de volta no corredor perto da escada oeste.
5. **Escada oeste** — dois andares de lances e patamares com invasores descendo.
6. **Terraco** — heliponto, ar-condicionados e caixa d'agua como cobertura, seis
   invasores (o chefe, Lobo, tem mais vida e larga a sniper). Com o terraco limpo
   o rotor liga: **E no helicoptero**.
7. **Cinematica final**: o personagem corre para o helicoptero, ele decola com a
   camera girando em volta e some por cima da cidade. Tela de fase concluida com
   tempo, abates, mortes, XP e moedas (30 na primeira vez).

- **Inimigos com visao de verdade**: so enxergam o que esta na frente e com
  linha livre (parede, porta fechada e movel escondem voce). Correr faz barulho;
  tiro e granada alertam quem esta perto. Alertados, eles se mexem de lado,
  procuram onde voce foi visto por ultimo e atiram em rajadas (pistola, rifle ou
  escopeta — cada uma com dano, cadencia e alcance proprios).
- **Checkpoints** no patamar do andar 1, na escada oeste e no terraco. Morreu,
  volta do ultimo com as armas e itens que tinha nele; os inimigos daquela parte
  voltam, e caixas e lapides voltam a ter o que tinham.
- **Objetivo** no canto de cima e falas do personagem aparecem conforme voce
  avanca.
- Tudo desenhado no mesmo traco preto e branco: reboco, concreto, azulejo,
  carpete, portas numeradas, placas de SAIDA, pichacao, entulho e a cidade em
  volta sao texturas feitas em canvas (`src/historia/texturas.js`).

Para criar a proxima fase: um arquivo como `src/historia/fase1.js` (inimigos,
areas, checkpoints, caixas e cinematicas) mais um mapa como `mapa1.js`, e
registrar em `FASES` no `src/historia/historia.js`.

## Jogar solo

Na aba **JOGAR SOLO** voce escolhe o operador e cai numa partida com **5 bots do
seu lado e 5 do outro**. Os bots do time de frente usam os outros operadores,
para nao dar confusao na hora do tiro.

- A partida roda inteira na sua maquina: `src/solo.js` finge ser o servidor
  (recebe as mesmas mensagens e devolve os mesmos eventos), entao o resto do jogo
  nem percebe a diferenca — mapa, caixas, times, placar e recompensas sao iguais.
- Os bots patrulham o miolo do mapa, marcam o inimigo mais proximo, avancam ate a
  distancia de tiro e erram mais quanto mais longe estao. Levam dano, morrem,
  renascem depois de 4 s e contam para o placar do time.
- Rodando a partida por um minuto, o placar ficou 11 x 10 — sem sobra para nenhum
  dos lados.

## Como jogar junto

1. Um jogador escreve o nome no topo do menu e usa a aba **CRIAR SALA**.
2. Aparece o **codigo** (com botao COPIAR) e a contagem de jogadores na sala.
3. O outro abre a aba **ENTRAR SALA** e cola o codigo.
4. Na sala cada um escolhe **TIME A** ou **TIME B** — os dois quadros mostram
   quem ja esta em cada time, e quem entra cai no time mais vazio.
5. O dono da sala clica em **INICIAR PARTIDA** — da pra comecar sozinho para treinar.
6. Cada um escolhe entre **Personagem 1**, **Personagem 2** e **Jaime** (aparece o
   desenho de cada um). Quando todo mundo escolhe, a partida comeca.
7. Vale 4 tiros para derrubar alguem (25 de dano cada). Quem morre renasce em 3s.
   Quem chega no meio de uma partida ja em andamento entra direto, so escolhendo
   o personagem.

## Times

- Cada time nasce de um lado do campo (time A ao norte, time B ao sul).
- **Aliado nao toma tiro de aliado**: o servidor recusa o dano entre gente do
  mesmo time, e a granada tambem nao machuca companheiro (mas ainda machuca voce).
- Todo aliado aparece com uma **plaquinha com o nome** flutuando acima dele,
  para nao levar tiro por engano; inimigo nao tem plaquinha.
- No alto da tela ficam as **duas barras de placar**. Cada abate enche a barra do
  time do matador.
- **O primeiro time a chegar em 50 abates ganha** e a partida acaba para todo
  mundo, com a tela de vitoria/derrota e o placar final. Depois todos voltam
  para a sala e da para jogar de novo.

## Controles

| Tecla | Acao |
|---|---|
| W A S D | mover |
| Mouse | olhar |
| Botao esquerdo | atirar (rifle e automatico, pistola e tiro a tiro) |
| **Botao direito** | **mirar** — a arma sai da tela e entra a mira correspondente, com zoom e mouse mais lento |
| **1 a 3 ou roda do mouse** | arma 1 · arma 2 · faca (campo vazio = maos) |
| **E** | abrir a caixa na sua frente / saquear uma lapide RIP / pegar o item do chao |
| **I** | abrir a mochila (9 espacos + 2 armas + faca) |
| **G** | pegar/guardar a granada (aparece na mao) |
| **Q** | usar um curativo (+35 de vida) |
| **C** | acender o cigarro (velocidade + visao pelos inimigos) |
| Shift | correr |
| Espaco | pular |
| Ctrl | agachar |
| R | recarregar |
| Tab | placar |
| ESC | pausa — menu no meio da tela com **continuar**, **configuracoes** e **sair do jogo** |

## Armas

Sao **tres campos de arma** (teclas 1 a 3, ou a roda do mouse passando por eles):
**ARMA 1** e **ARMA 2** para armas de fogo e o campo **FACA**, so para ela.

**Todo mundo nasce (e renasce) so com a pistola e a faca.** Rifle, escopeta e
sniper estao **dentro das caixas** — 55% das caixas das cabanas e 30% das do
campo trazem uma arma, dando em media uns 3-4 rifles, 3 escopetas e 1 sniper por
mapa. Ou pegue as de quem morreu, na lapide (veja abaixo).

| | Rifle | Pistola | Faca | Escopeta | Sniper |
|---|---|---|---|---|---|
| Onde | caixa | nasce com ela | nasce com ela | caixa | caixa (rara) |
| Municao | 12 | 8 | — | 5 | 5 |
| Dano | 25 | 34 | **60** | 13 por bolinha (8 bolinhas) | **100** |
| Disparo | automatico | tiro a tiro | golpe de perto (2,4 m) | leque, dano cai de 8 a 30 m | um tiro por vez, lento |
| Mira | `mira.png` | `mira-pistola.png` | — | `escopeta/Mirando.png` | luneta com lente |
| Zoom | FOV 42 | FOV 52 | — | FOV 60 | **FOV 14** |

- **Escopeta:** cada tiro solta 8 bolinhas em leque (mais fechado mirando). Todas
  as bolinhas que acertam a mesma pessoa viram um dano so, entao de perto ela
  derruba com um tiro (ate uns 8 m); a 15 m tira em media metade da vida
  e a 28 m quase nada.
- **Sniper:** mirando, entra o `mirando-snipe.png` com uma lente de verdade dentro
  do buraco — reticula duplex (fina no meio, grossa nas pontas), ponto vermelho,
  borda do vidro escurecida e o resto da tela preto em volta. A luneta balanca de
  leve com a respiracao e o mouse fica bem mais lento. Sem mirar, o tiro sai
  desviado do centro.
  Alcance de 450 m (atravessa o mapa); as outras armas vao ate 220 m.
- **O tiro atravessa a parte transparente dos desenhos.** Arvore, pedra, arbusto,
  poste e personagem sao retangulos com um desenho dentro; a bala le a
  transparencia no ponto do acerto e so para no que aparece na tela. O tronco e
  a copa continuam servindo de protecao, o vazio ao lado deles nao.

Cada arma de fogo guarda a propria municao, entao trocar no meio da luta nao
perde o pente. Tudo isso fica em `src/weapons.js` — um objeto por arma, com o
ponto do cano e o ponto de visada medidos no PNG.

O desenho da faca veio com fundo branco (em vez de transparente), entao ela usa
`mix-blend-mode: multiply` na tela: o branco some e fica so o traco. Se outra
arma vier assim, basta marcar `fundoBranco: true` no catalogo.

## Cabanas

Espalhadas pelo campo, 7 construcoes **3D de verdade** (nao sao sprites): da
para entrar, se esconder atras da parede e atirar pela janela. Sao tres modelos:

| Modelo | Material | Tamanho | Telhado |
|---|---|---|---|
| Cabana | madeira | 6,4 x 5,6 m | duas aguas |
| Casa | tijolo | 7,6 x 6,4 m | uma agua |
| Barracao | madeira | 10,5 x 5,2 m | duas aguas |

- As texturas (tabua, tijolo, telha e piso) sao **desenhadas em canvas** com
  traco tremido, no mesmo estilo preto e branco do resto do jogo — nenhuma
  imagem externa: `plankTexture`, `brickTexture`, `roofTexture` e `floorTexture`
  em `src/textures.js`.
- Cada parede e montada em pedacos em volta das portas e janelas, e cada pedaco
  vira uma barreira que barra o jogador (as vergas, que ficam acima da cabeca,
  nao barram). Testado: das 24 direcoes possiveis, so entra quem passa pela porta.
- As cabanas vem da mesma semente do servidor, entao estao no mesmo lugar para
  todo mundo, e as arvores nao nascem dentro delas.
- **Toda cabana tem 1 ou 2 caixas de suprimento la dentro**, e essas sao as mais
  recheadas do mapa.

## Grama

O campo inteiro (menos o piso das cabanas) e coberto por tufos de grama branca
desenhada a traco, no espirito do Zelda:

- **Balanca com o vento**: uma onda lenta atravessa o campo (rajada) somada a
  uma tremidinha propria de cada tufo, tudo no vertex shader.
- **Abre quando alguem passa**: perto do jogador as folhas se inclinam para o
  lado oposto e abaixam, e voltam sozinhas quando ele se afasta.
- **Nao nasce dentro das cabanas**: o shader recebe o retangulo de cada cabana
  e zera os tufos que caem la dentro.
- O tapete de grama tem 96 m de lado e **segue o jogador**: o shader manda cada
  tufo para a copia mais proxima de quem esta jogando (um `mod`), entao a CPU
  nao reposiciona nada e a grama nunca acaba. Na borda os tufos encolhem, para
  nao nascerem do nada na frente da camera.

Se o jogo pesar na sua maquina, baixe `COUNT` no topo de `src/grass.js`
(17000 tufos por padrao).

## Mochila, armas e itens no chao

A mochila tem **9 espacos** para granada, curativo e cigarro, mais **3 campos de
arma**: ARMA 1 e ARMA 2 (qualquer arma de fogo) e FACA (tracejado, so a faca).

- **I** abre a mochila a qualquer hora; **E** abre a caixa que estiver na frente.
- Espalhadas pelo mapa (e dentro das cabanas), as caixas aparecem como
  `caixa/caixa.png`. Quando voce chega perto e olha para uma, o sprite troca para
  `caixa/caixa-e.png` e o aviso **E abrir caixa** aparece.
- **Arraste** para mover: da caixa para a mochila, da caixa para um campo de arma,
  ou de um campo de arma para o outro (troca as duas de lugar). Duplo clique
  tambem pega, para quem preferir.
- **Arraste para JOGAR FORA** e o item sai do inventario e **cai no chao**, na sua
  frente. No chao ele fica **flutuando e girando**, estilo Warzone/Minecraft, e
  ganha volume por empilhamento: 14 copias do PNG separadas em profundidade, as
  de tras mais escuras — girando, da para ver a "espessura" do desenho.
- Chegando perto de um item no chao aparece **E pegar**. Arma vai para o campo 1
  ou 2 que estiver livre; se os dois estiverem cheios, ela troca com a que esta
  na mao (ou com a ARMA 1, se a mao estiver na faca) e a antiga cai no chao. A
  troca de lugar arrastando so vale entre ARMA 1 e ARMA 2 — a faca fica no campo
  dela, e com uma faca ja guardada nao da para pegar outra.
- **Campo de arma vazio = maos vazias**: trocando para ele (tecla 1 ou 2) voce
  fica so com a mao na tela, sem municao e sem conseguir atirar.
- Quem decide quem ficou com o item e o servidor — dois jogadores nao pegam a
  mesma granada, nem o mesmo item do chao.
- **Granada** (`itens/granada.png`): com **G** ela vai para a mao (`mão-solo.png`
  segurando a granada) e a **curva da trajetoria** ja aparece — uma fileira de
  pontos ate a marca no chao de onde ela vai cair. Segurando o botao direito a
  curva fica mais marcada. A previsao roda a mesma fisica do arremesso, entao
  nao mente. O botao esquerdo joga; ela quica, estoura em 2,4 s e faz ate 95 de
  dano em 6,5 m (inclusive em voce, se ficar perto).
- **A explosao** vem em camadas, cada uma no seu tempo: um clarao de luz que
  ilumina o cenario em volta, a bola de fogo, faiscas e estilhacos que voam e
  quicam no chao, uma onda de choque de poeira, a fumaca (comeca preta de
  fuligem, se abre, sobe e clareia ate sumir em uns 5 s) e uma marca de queimado
  que fica no chao por 16 s. Quem estiver perto sente a camera tremer, e o
  tremor diminui com a distancia. Tudo em `_explode()` no `src/grenade.js`.
- **Curativo** (`itens/vida.png`): **Q** devolve 35 de vida, com a conta feita no
  servidor.
- **Cigarro** (`itens/cigarro.png`): o item **raro** — aparece em cerca de 7% das
  caixas (12% nas de dentro das cabanas, 3% nas do campo). No **C** ele acende:
  uma baforada toma a tela e voce ganha **10 s correndo mais rapido** e
  **5 s enxergando os inimigos em vermelho atraves de tudo** (parede, cabana,
  arvore). Um contador no rodape mostra quanto falta de cada efeito.

## Lapide RIP

Quando alguem morre — jogador ou bot — nasce uma **lapide com RIP** no lugar
exato da morte, desenhada em canvas no mesmo traco do jogo (`tombstoneTexture`
em `src/textures.js`).

- **Tudo o que a pessoa carregava vai para a lapide**: as armas dos tres campos e
  os itens da mochila. Quem morreu fica sem nada ate renascer, e renasce so com
  pistola e faca.
- Chegando perto e olhando para ela, o traco engrossa, aparece um brilho de
  rabisco e o aviso **E saquear &lt;nome&gt;**. O **E** abre a mesma tela da caixa,
  com o titulo **RIP** e o nome de quem caiu — e so arrastar.
- **Qualquer um pode saquear**, aliado ou inimigo, e quem chegar primeiro leva: o
  servidor tira o item da lapide e avisa todo mundo.
- A lapide some sozinha depois de **2 minutos**; com mais de 40 no mapa a mais
  antiga vai embora antes.
- Online, quem morreu manda a lista do que carregava; o servidor so aceita **uma
  lapide por morte** e so itens que existem no jogo (`ITENS_VALIDOS` em
  `src/mapgen.js`). Quem entra com a partida rolando ja recebe as lapides que
  estao no mapa.
- No solo, o bot que cai deixa pistola e faca e, as vezes, uma arma das caixas,
  curativo, granada ou (raramente) cigarro.

## Estrutura

```
server.js           servidor: arquivos estaticos + salas (WebSocket, porta unica)
index.html          menu inicial, telas (sala, escolha, pausa, fim) e HUD
fundo1.jpeg         arte de fundo do menu
style.css           telas, HUD e o view model da arma
Arvore.png          arvore do cenario (reduzida para 1024 px ao carregar)
arma.png            rifle em primeira pessoa   |  mira.png          mira do rifle
pistola.png         pistola em primeira pessoa |  mira-pistola.png  mira da pistola
mão-solo.png        mao vazia (segura a granada)
caixa/              caixa.png e caixa-e.png (caixa normal e destacada)
itens/              granada.png e vida.png
fonts/              Betania Patmos (fonte de desenho, servida local)
perssonagem1/       parado.png e mirando.png do personagem 1
perssonagem2/       parado.png e mirando.png do personagem 2
vendor/             Three.js r169 local (roda offline)
src/
  main.js           loop, telas, pointer lock, tiro, mira e ligacao com a rede
  menu.js           menu inicial: abas, loja, operador, fundo e configuracoes
  solo.js           partida contra bots, fingindo ser o servidor
  mapgen.js         cabanas e caixas (usado pelo servidor e pelo modo solo)
  historia/
    historia.js     modo historia: IA dos inimigos, areas, checkpoints, helicoptero
    cinematica.js   camera em trilho, tarjas de cinema, legendas, titulo e fade
    fase1.js        roteiro da fase 1 (inimigos, caixas, areas, cinematicas)
    mapa1.js        o predio da fase 1 (andares, escadas, apartamentos, terraco)
    construtor.js   paredes com vaos, lajes, lances de escada, placas e luzes
    moveis.js       cama, escrivaninha, sofa, ar-condicionado, helicoptero...
    texturas.js     reboco, concreto, portas, placas, cidade, heliponto
  profile.js        nome, nivel, XP, moedas e compras (salvo no navegador)
  settings.js       as configuracoes e como cada uma mexe no jogo
  net.js            cliente WebSocket (conecta no mesmo host da pagina)
  players.js        adversarios: sprite parado/mirando, interpolacao, morte
  world.js          chao, neblina, luzes/sombras e cenario espalhado
  huts.js           as tres cabanas 3D: paredes, portas, telhado e colisao
  grass.js          grama instanciada com vento e reacao a quem passa
  player.js         movimentacao, gravidade, pulo, agachar, colisao, head bob
  weapon.js         view model: municao, cadencia, recuo, sway, mira e granada
  weapons.js        catalogo das armas (imagens, dano, pontos medidos no PNG)
  loot.js           caixas no mapa, mochila, campos de arma e o arrastar
  drops.js          itens largados no chao: giram, flutuam e tem espessura
  grenade.js        arremesso, linha da trajetoria, quique e explosao
  billboard.js      sprite 2D no mundo 3D (encara a camera + sombra)
  textures.js       texturas em canvas (arvores, pedras...) + leitor dos PNGs
```

## Como os personagens funcionam

- Sao tres operadores: **Personagem 1** (gratis), **Personagem 2** (60 moedas) e
  **Jaime** (gratis, pasta `Jaime/`). O Jaime tem um desenho so, usado nas duas
  poses. No modo solo seus aliados usam o seu operador e o time de frente sorteia
  entre os outros — Jaime incluso quando voce nao estiver com ele.
- Cada personagem tem duas poses: `parado.png` e `mirando.png`. O adversario
  aparece parado ate apertar o botao direito — ai o sprite dele troca para a
  pose de mira na tela de todo mundo, na hora (o estado vai junto com a posicao).
- Os PNGs sao recortados automaticamente no carregamento (a borda transparente
  some), e a pose "parado" define a altura de 1,85 m — a de mira mantem a
  proporcao original, sem esticar.
- Para trocar de personagem e so substituir os arquivos em `perssonagem1/` e
  `perssonagem2/` com os mesmos nomes.

## Como a mira funciona

Segurando o botao direito a arma desaparece por tras e a `mira.png` entra no
lugar dela, como nos FPS de celular: o jogo mede o vidro (a janela transparente)
dentro do PNG e desloca a imagem para que esse vidro caia no centro exato da
tela, em qualquer resolucao. Junto vao o zoom da camera (FOV 75 -> 42), o mouse
mais lento, a mirinha menor e o clarao do tiro saindo pela frente da mira.
Se trocar o desenho de uma mira, ajuste `aimPoint` (fracao do ponto de visada
dentro do PNG) e `scopeHeight` na entrada daquela arma em `src/weapons.js`.

## Como a rede funciona

- Um servidor so: HTTP (arquivos) e WebSocket dividem a mesma porta, entao nao
  existe endereco separado para configurar.
- Posicao, angulo e o estado de mira vao para o servidor 20x por segundo e sao
  repassados aos outros; no destino a posicao e interpolada para nao tremer.
- O tiro e conferido no cliente de quem atira (raycast do centro da tela) e o
  dano e aplicado no servidor, que valida se o atirador esta vivo, contabiliza
  abates e mortes e avisa todo mundo.
- O cenario e sorteado a partir de uma **semente enviada pelo servidor**, entao
  arvores, pedras e caixas nascem no mesmo lugar para todo mundo — sem isso um
  jogador teria cobertura onde o outro ve campo aberto.
- Sair da aba, cair a conexao ou fechar a sala e tratado: o jogador some da
  partida e a sala se apaga sozinha quando esvazia.

## Ajustes rapidos

- Dano, municao, cadencia, zoom e posicao de cada arma na tela: `src/weapons.js`.
- Tempo de renascer: `RESPAWN_TIME` no topo de `src/main.js`.
- Forca e raio da granada: `BLAST_DAMAGE`, `BLAST_RADIUS` e `FUSE` em `src/grenade.js`.
- Aparencia da curva: `ARC_DOTS`, `ARC_EVERY` e o `size` do material em `src/grenade.js`.
- Quantidade de caixas e o que vem dentro (inclusive a chance de arma):
  `makeBoxes()` em `src/mapgen.js`. Loadout de quem nasce: `LOADOUT_INICIAL` no
  mesmo arquivo.
- Tempo e limite das lapides: `LAPIDE_DURA` e `MAX_LAPIDES` em `server.js` (online)
  e em `src/solo.js` (solo).
- Quantidade e modelos das cabanas: `makeHuts()` em `server.js`; o formato de
  cada modelo (tamanho, portas, janelas, telhado) fica em `HUT_TYPES` no topo
  de `src/huts.js`.
- Espacos da mochila e quanto o curativo cura: `SLOTS` e `ITEMS` em `src/loot.js`.
- Itens no chao (espessura, altura, alcance para pegar): topo de `src/drops.js`.
- Fonte da interface: `--fonte` no topo de `style.css`.
- Precos, XP por abate e recompensas: `OPERADORES`, `FUNDOS` e `fecharPartida()`
  em `src/profile.js`; itens da loja em `LOJA`, no topo de `src/menu.js`.
- Opcoes graficas (valores de cada nivel): `OPCOES` em `src/settings.js`.
- Bots do modo solo (quantidade, pontaria, cadencia, velocidade): constantes no
  topo de `src/solo.js`.
- Grama: `COUNT` (quantidade), `AREA` (alcance), `ALTURA`, `LARGURA` e
  `RAIO_PISADA` no topo de `src/grass.js`.
- Velocidade / pulo / altura do olho: topo de `src/player.js`.
- Altura dos personagens: `HEIGHT` em `src/players.js`.
- Tamanho do campo, neblina e quantidade de arvores/pedras: `src/world.js`.
- Pontos de nascimento de cada time e limite de jogadores por sala: `SPAWNS` e o
  teste de `players.size` em `server.js`.
- Abates para vencer: `VITORIA` no topo de `server.js`.
