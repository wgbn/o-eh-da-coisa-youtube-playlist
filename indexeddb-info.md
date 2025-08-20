# Implementação do IndexedDB

## Visão Geral

Este projeto foi atualizado para usar o IndexedDB como mecanismo de armazenamento para os IDs de vídeos assistidos, substituindo o localStorage que tem limitações de espaço. O IndexedDB é uma API de banco de dados NoSQL que permite armazenar grandes quantidades de dados estruturados, incluindo arquivos e blobs.

## Estrutura do Banco de Dados

- **Nome do Banco**: `youtubePlaylistDB`
- **Versão**: 1
- **Object Store**: `watchedVideos`
- **Chave Primária**: `id` (ID do vídeo do YouTube)

## Novas Funcionalidades

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
- **Sistema de Notificações**: Fornece feedback visual sobre operações de sucesso ou erro
