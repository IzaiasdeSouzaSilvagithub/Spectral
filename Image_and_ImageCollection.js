/* ==================================================================================================================
O que é uma Image e uma ImageCollection no Google Earth Engine?

No Google Earth Engine, Image é a estrutura fundamental para representar os dados raster.
Basicamente, cada imagem é composta por:
  - Bandas: cada uma possui nome, tipo de dado, escala, máscara e projeção.
  - Propriedades: metadados associados (data, sensor, porcentagem de nuvens, etc.).

Já uma ImageCollection é um conjunto (coleção) de várias imagens, geralmente organizadas
no tempo ou por algum critério específico.

OBJETIVO: Demonstrar como trabalhar com Image e ImageCollection.
Dados: Landsat 9 (OLI/TIRS) - Collection 2, Tier 1.
Maiores informações sobre os dados: https://developers.google.com/earth-engine/datasets/catalog/LANDSAT_LC09_C02_T1_L2?hl=pt-br
===================================================================================================================== */

// ==================================================================================================================
// 1. IMPORTAR SUA ÁREA DE ESTUDO (ROI)
// ==================================================================================================================
var study_area = geometry;  // <-- Substitua pelo seu polígono ou use o desenhado


// ==================================================================================================================
// 2. CENTRALIZAR O MAPA NA ÁREA DE ESTUDO
// ==================================================================================================================
// O número 12 representa o nível de zoom (quanto maior, mais próximo)
Map.centerObject(study_area, 12);


// ==================================================================================================================
// 3. VISUALIZAR A ÁREA DE ESTUDO NO MAPA
// ==================================================================================================================
Map.addLayer(study_area, {color: 'yellow'}, 'ÁREA DE ESTUDO (ROI)', false);


// ==================================================================================================================
// 4. ACESSAR E FILTRAR A COLEÇÃO LANDSAT 9
// ==================================================================================================================
// Explicação: Uma ImageCollection é um conjunto de várias imagens
// Estamos aplicando 3 filtros principais:
// - filterDate: período de interesse (data inicial, data final)
// - filterBounds: apenas imagens que tocam nossa área de estudo
// - filterMetadata: porcentagem máxima de nuvens permitida

var L9 = ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")  // Coleção Landsat 9
    .filterDate('2026-01-01', '2026-04-30')            // FILTRO 1: Data (6 meses)
    .filterBounds(study_area)                          // FILTRO 2: Localização
    .filterMetadata('CLOUD_COVER', 'less_than', 30);   // FILTRO 3: Nuvens (<30%)


// ==================================================================================================================
// 5. VERIFICAR OS METADADOS DA COLEÇÃO FILTRADA
// ==================================================================================================================
print('QUANTAS IMAGENS FORAM ENCONTRADAS?', L9.size());
print('METADADOS COMPLETOS DA COLEÇÃO LANDSAT 9:', L9);
print('LISTA DE DATAS DISPONÍVEIS:', L9.aggregate_array('DATE_ACQUIRED'));



// ==================================================================================================================
// 6. ESCOLHER UMA IMAGEM ESPECÍFICA DA COLEÇÃO PELO ID
// ==================================================================================================================
// Substitua o ID abaixo por um que apareceu no catálogo acima!
var id_escolhido = 'LANDSAT/LC09/C02/T1_L2/LC09_222071_20260310';  // <-- COLE UM ID AQUI
var imagem = ee.Image(id_escolhido);
print('IMAGEM CARREGADA COM SUCESSO!');
print('ID:', imagem.id());
print('DATA DE AQUISIÇÃO:', imagem.date());
print('PORCENTAGEM DE NUVENS:', imagem.get('CLOUD_COVER'));
print('PROPRIEDADES COMPLETAS DA IMAGEM:', imagem);
print('BANDAS DISPONÍVEIS:', imagem.bandNames());


// ==================================================================================================================
// 7. APLICAR FATORES DE ESCALA (IMPORTANTE PARA VALORES REAIS!)
// ==================================================================================================================
// Os valores brutos do Landsat 9 precisam ser convertidos para reflectância real
// Fórmula: Reflectância = (valor_bruto * 0.0000275) - 0.2

function aplicarFatoresEscala(image) {
  // Bandas ópticas (reflectância - valores entre 0 e 1)
  var bandasOpticas = image.select('SR_B.').multiply(0.0000275).add(-0.2);
  
  // Bandas térmicas (temperatura em Kelvin)
  var bandasTermicas = image.select('ST_B.*').multiply(0.00341802).add(149.0);
  
  return image.addBands(bandasOpticas, null, true)
              .addBands(bandasTermicas, null, true);
}

var imagemProcessada = aplicarFatoresEscala(imagem);
print('IMAGEM APÓS FATORES DE ESCALA:', imagemProcessada);


// ==================================================================================================================
// 8. CALCULAR NDVI PARA A IMAGEM
// ==================================================================================================================
// NDVI = (NIR - VERMELHO) / (NIR + VERMELHO)
// NIR = Banda 5 (SR_B5) | VERMELHO = Banda 4 (SR_B4)

var ndvi = imagemProcessada.expression(
  '(NIR - RED) / (NIR + RED)', {
    'NIR': imagemProcessada.select('SR_B5'),
    'RED': imagemProcessada.select('SR_B4')
});

// Adicionar NDVI como nova banda
var imagemComNDVI = imagemProcessada.addBands(ndvi.rename('NDVI'));
print('NDVI CALCULADO:', ndvi);


// ==================================================================================================================
// 9. VISUALIZAR AS IMAGENS NO MAPA
// ==================================================================================================================

// 9.1 Configuração de visualização para COR VERDADEIRA (RGB)
var vizTrueColor = {
  bands: ['SR_B4', 'SR_B3', 'SR_B2'],  // Vermelho, Verde, Azul
  min: 0.0,
  max: 0.3,
  gamma: 1.2
};

// 9.2 Configuração para FALSA COR (NIR - útil para vegetação)
var vizFalsaCor = {
  bands: ['SR_B5', 'SR_B4', 'SR_B3'],  // NIR, Vermelho, Verde
  min: 0.0,
  max: 0.4,
  gamma: 1.2
};

// 9.3 Configuração para NDVI
var vizNDVI = {
  min: -0.2,
  max: 0.8,
  palette: [
    '#0000FF',
    '#00FFFF',
    '#FFFFFF',
    '#90EE90',
    '#32CD32',
    '#006400' 
  ]
};

// Adicionar camadas ao mapa 
Map.addLayer(imagemProcessada, vizTrueColor, 'IMAGEM (RGB)', false);
Map.addLayer(imagemProcessada.clip(study_area), vizTrueColor, 'MAGEM RECORTADA PELA ROI', false);
Map.addLayer(imagemProcessada.clip(study_area), vizFalsaCor, 'IMAGEM FALSA COR', false);
Map.addLayer(imagemComNDVI.select('NDVI').clip(study_area), vizNDVI, 'NDVI - ÍNDICE DE VEGETAÇÃO', false);

// Adicionar máscara de vegetação densa (NDVI > 0.8)
var vegetacaoDensa = imagemComNDVI.select('NDVI').gt(0.6);
var mascaraVegetacao = imagemProcessada.updateMask(vegetacaoDensa);
Map.addLayer(mascaraVegetacao.clip(study_area), vizTrueColor, 'VEGETAÇÃO DENSA (NDVI > 0.8)', false);


// ==================================================================================================================
// 10. ESTATÍSTICAS DO NDVI NA ROI
// ==================================================================================================================
// Calcular métricas resumidas do NDVI dentro da ROI
var statsNDVI = imagemComNDVI.select('NDVI').reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.stdDev(),
    sharedInputs: true
  }).combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }),
  geometry: study_area,
  scale: 30,  // Resolução do Landsat 9 (30 metros)
  maxPixels: 1e9,
  bestEffort: true
});

print('ESTATÍSTICAS DO NDVI NA ÁREA DE ESTUDO:');
print('MÉDIA DO NDVI:', statsNDVI.get('NDVI_mean'));
print('DESVIO PADRÃO DO NDVI:', statsNDVI.get('NDVI_stdDev'));
print('MÍNIMO DO NDVI:', statsNDVI.get('NDVI_min'));
print('MÁXIMO DO NDVI:', statsNDVI.get('NDVI_max'));


// ==================================================================================================================
// 11. APLICAR REDUCER (MEDIANA) NA COLEÇÃO
/* ==================================================================================================================
O que é um REDUCER? É uma ferramenta que agrega dados. Isto é, transformam muitos valores em um único resultado.
Reducers são o "coração" do Google Earth Engine.
É como fazer um "resumo" estatístico de um conjunto de dados.
===================================================================================================================== */

// A redução pela mediana pode ser útil para remover ruidos indesejados e criar uma imagem "mais limpa".
var L9_mediana = L9.map(aplicarFatoresEscala).median();
print('IMAGEM MEDIANA DA COLEÇÃO:', L9_mediana);
Map.addLayer(L9_mediana, vizTrueColor, 'MDIANA DA COLEÇÃO', false);

/* ==================================================================================================================
OBS.: É relevante entender que a redução apaga o histórico. 
A rigor, quando trabalhamos com redutores como a mediana, média ou máximo sobre uma ImageCollection, 
perdemos a informação genuinamente temporal. A imagem resultante que você obtém não representa nenhuma data específica,
mas sim um cômputo matemático de todas as imagens disponíveis no período analisado. 
Isso implica que, na prática, se você está interessado em uma informação de data específica (como o NDVI exatamente no dia 15 de março de 2024, ou a temperatura da superfície durante um evento de seca em uma data particular), 
essa composição temporal NÃO é fidedigna.
===================================================================================================================== */

// 12. CALCULAR NDVI SOBRE A IMAGEM MEDIANA
// Agora aplicamos a MESMA lógica do NDVI, mas usando a imagem mediana em vez da imagem original.
var ndviMediana = L9_mediana.expression(
  '(NIR - RED) / (NIR + RED)', {
    'NIR': L9_mediana.select('SR_B5'),   // Infravermelho Próximo (Banda 5)
    'RED': L9_mediana.select('SR_B4')    // Vermelho (Banda 4)
});

print('NDVI CALCULADO SOBRE A MEDIANA:', ndviMediana);
print('ESTATÍSTICAS DO NDVI (MEDIANA):', ndviMediana.reduceRegion({
  reducer: ee.Reducer.mean().combine({
    reducer2: ee.Reducer.minMax(),
    sharedInputs: true
  }),
  geometry: study_area,
  scale: 30,
  bestEffort: true
}));

// Adicionar NDVI como uma nova banda na imagem mediana
var medianaComNDVI = L9_mediana.addBands(ndviMediana.rename('NDVI'));
print('AGEM MEDIANA COM BANDA NDVI:', medianaComNDVI);


// ==================================================================================================================
// 13. VISUALIZAR O NDVI DA MEDIANA NO MAPA
// ==================================================================================================================
// Configuração de visualização para o NDVI
var vizNDVI_Mediana = {
  min: -0.2,
  max: 0.8,
  palette: [
    '#0000FF',
    '#00FFFF',
    '#FFFFFF',
    '#90EE90',
    '#32CD32',
    '#006400'
  ]
};

// Adicionar camada do NDVI da mediana
Map.addLayer(medianaComNDVI.select('NDVI').clip(study_area), vizNDVI_Mediana, 'NDVI DA MEDIANA', false);
