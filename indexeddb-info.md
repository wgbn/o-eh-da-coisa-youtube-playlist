# Implementação do IndexedDB

## Visão Geral

Este projeto foi atualizado para usar o IndexedDB como mecanismo de armazenamento tanto para os IDs de vídeos assistidos quanto para o cache completo dos vídeos da playlist, substituindo o localStorage que tem limitações de espaço. O IndexedDB é uma API de banco de dados NoSQL que permite armazenar grandes quantidades de dados estruturados, incluindo arquivos e blobs.

### Atualização de Versão do Banco de Dados

O banco de dados foi atualizado da versão 1 para a versão 2 para incluir o novo object store `videoCache`. Para garantir a compatibilidade com instalações existentes, implementamos um sistema de verificação e atualização automática:

```javascript
// Verifica se o banco precisa ser atualizado
async function checkAndDeleteDatabase() {
    // Verifica a versão atual do banco
    const db = await openDatabase();
    const currentVersion = db.version;
    db.close();
    
    // Se a versão for antiga, deleta o banco para recriar
    if (currentVersion < DB_VERSION) {
        await deleteDatabase();
        return true;
    }
    return false;
}
```

Este mecanismo garante que usuários com a versão antiga do banco de dados tenham seus bancos atualizados automaticamente para a nova estrutura sem perda de dados importantes.

## Estrutura do Banco de Dados

- **Nome do Banco**: `youtubePlaylistDB`
- **Versão**: 2
- **Object Stores**:
  - `watchedVideos`: Armazena IDs de vídeos assistidos (chave primária: `id`)
  - `videoCache`: Armazena dados completos dos vídeos da playlist (chave primária: `id`)

## Novas Funcionalidades

### Otimização de Consultas à API do YouTube

O sistema agora armazena o último `pageToken` da API do YouTube no localStorage, permitindo que apenas novos vídeos sejam carregados em consultas subsequentes:

- **Armazenamento de Token**: Salva o último `pageToken` para continuar de onde parou
- **Consultas Incrementais**: Busca apenas novos vídeos adicionados à playlist desde a última consulta
- **Atualização Forçada**: Botão para forçar uma atualização completa da playlist quando necessário
- **Atualização Automática**: Força atualização completa após 24 horas para garantir sincronização

### Exportação e Importação de Dados

O sistema agora permite exportar e importar dados, facilitando a transferência entre dispositivos ou a criação de backups:

- **Exportação**: Gera um arquivo JSON com todos os IDs de vídeos assistidos
- **Importação**: Permite carregar um arquivo JSON previamente exportado

### Backup Automático

O sistema mantém automaticamente um backup dos dados no localStorage com a chave `watchedVideos_backup`, garantindo que os dados possam ser recuperados mesmo em caso de problemas com o IndexedDB.

## Funções Principais

### Inicialização do Banco de Dados

```javascript
async function initDB() {
    // Abre ou cria o banco de dados
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    // Manipuladores de eventos para sucesso, erro e atualização
    request.onerror = (event) => { /* tratamento de erro */ };
    request.onsuccess = (event) => { /* manipulação do banco aberto */ };
    request.onupgradeneeded = (event) => { /* criação/atualização da estrutura */ };
    request.onblocked = (event) => { /* tratamento para conexões bloqueadas */ };
}
```

### Migração de Dados

Durante a primeira inicialização ou atualização do banco de dados, os dados existentes no localStorage são migrados automaticamente para o IndexedDB:

```javascript
function migrateFromLocalStorage(db) {
    const localData = localStorage.getItem(STORAGE_KEY);
    if (localData) {
        const videoIds = JSON.parse(localData);
        // Salva cada ID no IndexedDB e cria um backup
        localStorage.setItem(`${STORAGE_KEY}_backup`, localData);
        // Remove dados do localStorage após migração bem-sucedida
        localStorage.removeItem(STORAGE_KEY);
    }
}
```

### Operações CRUD

- **Leitura**: `getWatchedVideos()` - Retorna um Set com todos os IDs de vídeos assistidos
- **Escrita**: `saveWatchedVideos(watchedVideos)` - Salva o conjunto de IDs de vídeos assistidos

### Gerenciamento de Dados

- **Exportação**: `exportarDados()` - Exporta todos os dados para um arquivo JSON
- **Importação**: `importarDados(arquivo)` - Importa dados de um arquivo JSON
- **Limpeza**: `limparDadosAntigos(maxAgeDays)` - Remove registros mais antigos que o número de dias especificado

## Vantagens do IndexedDB

1. **Maior Capacidade de Armazenamento**: Muito superior ao localStorage (geralmente limitado a 5-10MB)
2. **Operações Assíncronas**: Não bloqueia a thread principal
3. **Suporte a Transações**: Garante a integridade dos dados
4. **Indexação**: Permite consultas mais eficientes
5. **Armazenamento Estruturado**: Permite armazenar objetos complexos, não apenas strings

## Sistema de Fallback

O sistema implementa uma estratégia robusta de fallback em múltiplas camadas:

1. **Tentativa Principal**: Usar IndexedDB para todas as operações
2. **Primeiro Fallback**: Verificar dados de backup no localStorage (`watchedVideos_backup`)
3. **Segundo Fallback**: Verificar dados originais no localStorage (`watchedVideos`)
4. **Último Recurso**: Iniciar com um conjunto vazio se nenhum dado for encontrado

Esta abordagem garante máxima resiliência e compatibilidade entre navegadores.

## Interface do Usuário

A interface foi atualizada para incluir:

- **Botão de Exportação**: Permite ao usuário baixar um arquivo JSON com seus dados
- **Botão de Importação**: Permite ao usuário carregar um arquivo JSON com dados previamente exportados
- **Botão de Atualização**: Permite forçar uma atualização completa da playlist do YouTube
- **Sistema de Notificações**: Fornece feedback visual sobre operações de sucesso ou erro

## Correções de Bugs e Melhorias de Segurança

### Loop Infinito na Última Página

Corrigido um bug que causava um loop infinito quando a API do YouTube retornava a última página da playlist:

```javascript
// Antes: O loop não terminava corretamente quando não havia mais páginas
if (data.nextPageToken) {
    nextPageToken = data.nextPageToken;
} else {
    clearStoredToken();
    // nextPageToken continuava com valor anterior, causando loop infinito
}

// Depois: Garantindo que o loop termina quando não há mais páginas
if (data.nextPageToken) {
    nextPageToken = data.nextPageToken;
} else {
    clearStoredToken();
    nextPageToken = ''; // Zera o token para sair do loop
}
```

### Limite Máximo de Páginas

Implementado um limite máximo de páginas para evitar loops infinitos e consumo excessivo de recursos:

```javascript
// Configuração do limite de páginas
let pageCount = 0;
const MAX_PAGES = 10;

// Verificação durante o carregamento
if (pageCount >= MAX_PAGES) {
    console.warn(`Limite máximo de ${MAX_PAGES} páginas atingido.`);
    document.dispatchEvent(new CustomEvent('limitePaginasAtingido', { 
        detail: { message: `Limite de ${MAX_PAGES} páginas atingido.` } 
    }));
    break;
}
```

### Detecção de Tokens Repetidos

Implementado sistema para detectar quando o mesmo pageToken é usado repetidamente, evitando loops infinitos:

```javascript
let lastUsedToken = '';

// Verificação de segurança para evitar loops infinitos
if (nextPageToken === lastUsedToken && nextPageToken !== '') {
    console.warn('Possível loop infinito detectado!');
    clearStoredToken();
    break;
}

lastUsedToken = nextPageToken;
```

### Correção de Datas no Cache

Corrigido um problema onde as datas armazenadas no cache não eram convertidas corretamente para objetos `Date` quando recuperadas:

```javascript
// Antes: Datas do cache eram strings e causavam erro na interface
const videos = await getVideosFromCache();
return videos; // publishedAt era uma string, não um objeto Date

// Depois: Conversão automática de datas ao recuperar do cache
const videos = await getVideosFromCache();
// A função getVideosFromCache já converte as datas automaticamente
const videosComDatasCorrigidas = videos.map(video => {
    try {
        return {
            ...video,
            publishedAt: new Date(video.publishedAt)
        };
    } catch (error) {
        console.warn(`Erro ao converter data para o vídeo ${video.id}`);
        return {
            ...video,
            publishedAt: new Date()
        };
    }
});
return videosComDatasCorrigidas;
```

### Tratamento de Datas Inválidas na Interface

Implementado tratamento robusto para evitar erros quando as datas são inválidas:

```javascript
function formatarData(data) {
    try {
        // Verifica se é um objeto Date válido
        if (data instanceof Date && !isNaN(data)) {
            return data.toLocaleDateString();
        }
        
        // Tenta converter para Date se for uma string
        if (typeof data === 'string') {
            const dataObj = new Date(data);
            if (!isNaN(dataObj)) {
                return dataObj.toLocaleDateString();
            }
        }
        
        // Fallback para casos de erro
        return 'Data não disponível';
    } catch (error) {
        return 'Data não disponível';
    }
}
```

### Tratamento Avançado de Erros da API

Implementado sistema detalhado de tratamento de erros com notificações específicas para cada tipo de erro:

```javascript
// Exemplos de tratamento de erros específicos
if (response.status === 403) {
    document.dispatchEvent(new CustomEvent('erroAPI', { 
        detail: { 
            message: 'Acesso negado à API do YouTube. Verifique sua chave de API.', 
            code: 403,
            tipo: 'acesso_negado'
        } 
    }));
} else if (response.status === 429) {
    document.dispatchEvent(new CustomEvent('erroAPI', { 
        detail: { 
            message: 'Limite de requisições à API excedido.', 
            code: 429,
            tipo: 'limite_excedido'
        } 
    }));
}
```

### Interface de Erros Aprimorada

Implementada uma nova interface de exibição de erros com informações detalhadas e sugestões de solução:

```javascript
/**
 * Exibe uma mensagem de erro na interface com opção de fechar
 * @param {string} message - Mensagem de erro
 * @param {Object} options - Opções adicionais
 * @param {string} options.tipo - Tipo de erro (api, cache, rede, etc)
 * @param {number} options.codigo - Código de erro, se aplicável
 * @param {string} options.solucao - Sugestão de solução, se disponível
 */
export function showError(message, options = {}) {
    // Remove qualquer erro existente
    const existingError = document.querySelector('.error-message');
    if (existingError) {
        existingError.remove();
    }
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    
    // Cria o conteúdo do erro com título e botão de fechar
    let errorContent = `
        <div class="error-header">
            <h3>Erro${options.codigo ? ` (${options.codigo})` : ''}</h3>
            <button class="close-error">×</button>
        </div>
        <div class="error-body">
            <p>${message}</p>
    `;
    
    // Adiciona informações adicionais se disponíveis
    if (options.tipo) {
        errorContent += `<p class="error-type">Tipo: ${options.tipo}</p>`;
    }
    
    if (options.solucao) {
        errorContent += `<p class="error-solution"><strong>Solução sugerida:</strong> ${options.solucao}</p>`;
    }
    
    errorContent += '</div>';
    errorDiv.innerHTML = errorContent;
    
    document.querySelector('.container').appendChild(errorDiv);
    
    // Adiciona evento para fechar o erro
    errorDiv.querySelector('.close-error').addEventListener('click', () => {
        errorDiv.classList.add('fade-out');
        setTimeout(() => errorDiv.remove(), 500);
    });
    
    // Adiciona classe para animação de entrada
    setTimeout(() => errorDiv.classList.add('show'), 10);
}
```

### Análise Inteligente de Erros

Implementado sistema para analisar erros e fornecer informações contextuais e soluções específicas:

```javascript
/**
 * Analisa o erro para fornecer informações mais detalhadas
 * @param {Error} error - O objeto de erro
 * @returns {Object} Opções para a função showError
 */
function analisarErro(error) {
    const options = {};
    
    // Verifica se é um erro de API do YouTube
    if (error.message.includes('API do YouTube')) {
        options.tipo = 'API YouTube';
        
        if (error.message.includes('403')) {
            options.codigo = 403;
            options.solucao = 'Verifique se sua chave de API está correta e tem permissões adequadas.';
        } else if (error.message.includes('404')) {
            options.codigo = 404;
            options.solucao = 'Verifique se o ID da playlist está correto.';
        } else if (error.message.includes('429')) {
            options.codigo = 429;
            options.solucao = 'Aguarde alguns minutos e tente novamente. A API do YouTube tem limites de requisições.';
        }
    }
    // Verifica se é um erro de rede
    else if (error.message.includes('Failed to fetch') || error.message.includes('Network Error')) {
        options.tipo = 'Conexão';
        options.solucao = 'Verifique sua conexão com a internet e tente novamente.';
    }
    // Verifica se é um erro de cache
    else if (error.message.includes('cache')) {
        options.tipo = 'Cache';
        options.solucao = 'Tente limpar o cache do navegador e recarregar a página.';
    }
    // Verifica se é um erro de configuração
    else if (error.message.includes('chave de API')) {
        options.tipo = 'Configuração';
        options.solucao = 'Configure sua chave de API do YouTube no arquivo config.js.';
    }
    
    return options;
}
```

### Melhorias Visuais na Exibição de Erros

Implementados novos estilos CSS para melhorar a experiência do usuário com mensagens de erro:

```css
.error-message {
    background-color: #ffebee;
    color: #c62828;
    padding: 0;
    border-radius: 8px;
    margin: 20px 0;
    border: 1px solid #ef9a9a;
    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
    max-width: 600px;
    margin-left: auto;
    margin-right: auto;
    opacity: 0;
    transform: translateY(-20px);
    transition: opacity 0.3s, transform 0.3s;
}

.error-message.show {
    opacity: 1;
    transform: translateY(0);
}

.error-header {
    background-color: #f44336;
    color: white;
    padding: 12px 15px;
    border-top-left-radius: 8px;
    border-top-right-radius: 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.error-solution {
    background-color: #e8f5e9;
    padding: 10px;
    border-radius: 4px;
    margin-top: 10px;
    border-left: 4px solid #4caf50;
}
```

## Otimização de Desempenho

### Armazenamento de pageToken

O sistema implementa uma estratégia de otimização para consultas à API do YouTube:

```javascript
// Armazena o último pageToken após cada consulta
saveLastPageToken(nextPageToken);

// Recupera o token armazenado na próxima inicialização
const storedToken = getLastPageToken();
```

### Cache Local de Vídeos

Além do armazenamento de pageToken, o sistema agora implementa um cache local completo dos vídeos da playlist usando IndexedDB:

```javascript
// Salva os vídeos no cache IndexedDB após cada consulta bem-sucedida
await saveVideosToCache(videos);

// Verifica e usa o cache local antes de consultar a API
const isCacheValido = await isCacheValid();
if (useCache && isCacheValido) {
    const cachedVideos = await getVideosFromCache();
    // Usa os vídeos em cache se disponíveis
}
```

#### Características do Cache de Vídeos

- **Armazenamento em IndexedDB**: Permite armazenar grandes quantidades de vídeos sem as limitações do localStorage
- **Operações Assíncronas**: Todas as operações de cache são assíncronas para não bloquear a thread principal
- **Validade Temporal**: O cache expira após 24 horas para garantir dados atualizados
- **Notificação ao Usuário**: Informa quando está usando dados em cache e há quanto tempo foram armazenados
- **Limpeza Automática**: O cache é limpo quando uma atualização forçada é solicitada
- **Contagem de Novos Vídeos**: Informa quantos novos vídeos foram adicionados à playlist desde a última consulta
- **Sistema de Fallback**: Caso o IndexedDB falhe, o sistema tenta usar o localStorage como alternativa

### Benefícios da Otimização

1. **Redução de Tráfego de Rede**: Apenas novos vídeos são baixados
2. **Carregamento Mais Rápido**: Menos dados para processar em cada inicialização
3. **Economia de Cota da API**: Reduz o número de requisições à API do YouTube
4. **Experiência do Usuário Melhorada**: Feedback visual sobre o processo de atualização
5. **Funcionamento Offline**: Permite visualizar a playlist mesmo sem conexão com a API
