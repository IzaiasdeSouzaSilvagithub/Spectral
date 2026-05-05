/* ==================================================================================================================
ÍNDICES ESPECTRAIS COMUMENTE UTILIZADOS NO ESTUDO DA VEGETAÇÃO
=====================================================================================================================

OBJETIVO: Demonstrar como calcular índices espectrais usando dados de Sensoriamento Remoto Orbital.
Exemplos demonstrados usando dados do MSI (Sentinel-2).

O código cobre:
1. Como importar e filtrar coleções de imagens (Sentinel-2)
2. Como remover nuvens usando máscaras de qualidade (QA60)
3. Como calcular 13 índices espectrais diferentes
4. Como visualizar e exportar os resultados
5. Como gerar estatísticas e histogramas

REFERÊNCIAS:
- NDVI: Rouse et al. (1974) - NASA
- EVI: Huete et al. (1999) - Remote Sensing of Environment
- NDWI: Gao (1996) - Remote Sensing of Environment
- SAVI: Huete (1988) - Remote Sensing of Environment
- ARVI: Kaufman & Tanre (1992) - IEEE
===================================================================================================================== */

// ==================================================================================================================
// 1. DEFINIR ÁREA DE ESTUDO (ROI)
// ==================================================================================================================
// Você pode substituir este polígono pelo seu próprio ou desenhar no mapa
var study_area = geometry;


// ==================================================================================================================
// 2. CENTRALIZAR MAPA E CONFIGURAR VISUALIZAÇÃO
// ==================================================================================================================
Map.centerObject(study_area, 15);
Map.addLayer(study_area, {color: 'yellow'}, 'ÁREA DE ESTUDO (ROI)', false);


// ==================================================================================================================
// 3. FUNÇÃO PARA REMOVER NUVENS (SENTINEL-2)
// ==================================================================================================================
/* IMPORTANTE: A banda MSK_CLASSI_CIRRUS do Sentinel-2 contém informações sobre nuvens e cirrus.
   Valor 0 indica ausência de nuvens/cirrus.
   A divisão por 10000 converte os valores para reflectância (0-1). */

function removeClouds(image) {
  var qa = image.select('MSK_CLASSI_CIRRUS');
  var cloudBitMask = 1 << 10;  // Bit 10 para nuvens
  var cirrusBitMask = 1 << 11; // Bit 11 para cirrus
  
  // Criar máscara: TRUE onde NÃO há nuvens E NÃO há cirrus
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
              .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  
  // Aplicar máscara e converter para reflectância (0-1)
  return image.updateMask(mask).divide(10000);
}


// ==================================================================================================================
// 4. ACESSAR E FILTRAR A COLEÇÃO SENTINEL-2
// ==================================================================================================================
var sentinel2 = ee.ImageCollection("COPERNICUS/S2_SR")
    .filterDate('2026-01-25', '2026-05-30')      // Período de interesse
    .filterBounds(study_area)                     // Interseção com a ROI
    .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 10))  // Máximo de 10% de nuvens
    .map(removeClouds);                           // Aplicar máscara de nuvens

// Verificar quantas imagens foram encontradas
var imageCount = sentinel2.size();
print('QUANTIDADE DE IMAGENS ENCONTRADAS:', imageCount);

// Aplicar mediana para criar um mosaico
var mosaic = sentinel2.median();
print('BANDAS DO MOSAICO:', mosaic.bandNames());


// ==================================================================================================================
// 5. CONFIGURAÇÃO DE VISUALIZAÇÃO RGB
// ==================================================================================================================
var rgbVis = {
  min: 0.112,
  max: 0.492,
  bands: ['B4', 'B3', 'B2'],  // R,G,B
  gamma: 1.2
};

// Adicionar mosaico RGB ao mapa
Map.addLayer(mosaic.clip(study_area), rgbVis, 'SENTINEL-2 RGB', false);


// ==================================================================================================================
// 6. CALCULAR ÍNDICES ESPECTRAIS
// ==================================================================================================================

// 6.1 NDVI - Normalized Difference Vegetation Index (Rouse et al., 1974)
// Fórmula: (NIR - RED) / (NIR + RED)
var ndvi = mosaic.expression(
  '(NIR - RED) / (NIR + RED)', {
    'NIR': mosaic.select('B8'),
    'RED': mosaic.select('B4')
}).rename('NDVI');

// 6.2 EVI - Enhanced Vegetation Index (Huete et al., 1999)
// Fórmula: 2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)
var evi = mosaic.expression(
  '2.5 * (NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1)', {
    'NIR': mosaic.select('B8'),
    'RED': mosaic.select('B4'),
    'BLUE': mosaic.select('B2')
}).rename('EVI');

// 6.3 GNDVI - Green Normalized Difference Vegetation Index (Gitelson & Merzlyak, 1996)
// Fórmula: (NIR - GREEN) / (NIR + GREEN)
var gndvi = mosaic.normalizedDifference(['B8', 'B3']).rename('GNDVI');

// 6.4 NDWI - Normalized Difference Water Index (Gao, 1996)
// Fórmula: (NIR - SWIR) / (NIR + SWIR) [Para conteúdo de água em vegetação]
var ndwi = mosaic.normalizedDifference(['B8', 'B12']).rename('NDWI');

// 6.5 SAVI - Soil Adjusted Vegetation Index (Huete, 1988)
// Fórmula: ((NIR - RED) / (NIR + RED + L)) * (1 + L), onde L=0.5
var savi = mosaic.expression(
  '((NIR - RED) / (NIR + RED + 0.5)) * 1.5', {
    'NIR': mosaic.select('B8'),
    'RED': mosaic.select('B4')
}).rename('SAVI');

// 6.6 GCI - Green Chlorophyll Index (Gitelson et al., 2003)
// Fórmula: (NIR / GREEN) - 1
var gci = mosaic.expression(
  '(NIR / GREEN) - 1', {
    'NIR': mosaic.select('B8'),
    'GREEN': mosaic.select('B3')
}).rename('GCI');

// 6.7 ARVI - Atmospherically Resistant Vegetation Index (Kaufman & Tanre, 1992)
// Fórmula: (NIR - (2*RED) + BLUE) / (NIR + (2*RED) + BLUE)
var arvi = mosaic.expression(
  '(NIR - (2 * RED) + BLUE) / (NIR + (2 * RED) + BLUE)', {
    'NIR': mosaic.select('B8'),
    'RED': mosaic.select('B4'),
    'BLUE': mosaic.select('B2')
}).rename('ARVI');

// 6.8 GLI - Green Leaf Index (Louhaichi et al., 2001)
// Fórmula: ((GREEN - RED) + (GREEN - BLUE)) / ((2*GREEN) + RED + BLUE)
var gli = mosaic.expression(
  '((GREEN - RED) + (GREEN - BLUE)) / ((2 * GREEN) + RED + BLUE)', {
    'GREEN': mosaic.select('B3'),
    'RED': mosaic.select('B4'),
    'BLUE': mosaic.select('B2')
}).rename('GLI');

// 6.9 NBR - Normalized Burn Ratio (Key & Benson, 1999)
// Fórmula: (NIR - SWIR2) / (NIR + SWIR2)
var nbr = mosaic.normalizedDifference(['B8', 'B12']).rename('NBR');

// 6.10 NDMI - Normalized Difference Moisture Index (Wilson & Sader, 2002)
// Fórmula: (NIR - SWIR1) / (NIR + SWIR1) [SWIR1 = B11 para Sentinel-2]
var ndmi = mosaic.normalizedDifference(['B8', 'B11']).rename('NDMI');

// 6.11 MSI - Moisture Stress Index (Rock et al., 1986)
// Fórmula: SWIR1 / NIR
var msi = mosaic.expression(
  'SWIR / NIR', {
    'SWIR': mosaic.select('B11'),
    'NIR': mosaic.select('B8')
}).rename('MSI');

// 6.12 NDBI - Normalized Difference Built-up Index (Zha et al., 2003)
// Fórmula: (SWIR1 - NIR) / (SWIR1 + NIR)
var ndbi = mosaic.normalizedDifference(['B11', 'B8']).rename('NDBI');

// ==================================================================================================================
// 7. COMBINAR ÍNDICES EM UMA ÚNICA IMAGEM
// ==================================================================================================================
var allIndices = mosaic.addBands(ndvi)
    .addBands(evi)
    .addBands(gndvi)
    .addBands(ndwi)
    .addBands(savi)
    .addBands(gci)
    .addBands(arvi)
    .addBands(gli)
    .addBands(nbr)
    .addBands(ndmi)
    .addBands(msi)
    .addBands(ndbi);

print('IMAGEM COM TODOS OS ÍNDICES:', allIndices);
print('BANDAS DISPONÍVEIS:', allIndices.bandNames());


// ==================================================================================================================
// 8. PALETAS DE CORES PARA VISUALIZAÇÃO
// ==================================================================================================================
// Paleta geral para índices de vegetação
var vegPalette = [
  '#FFFFFF', '#CE7E45', '#DF923D', '#F1B555', '#FCD163', '#99B718',
  '#74A901', '#66A000', '#529400', '#3E8601', '#207401', '#056201',
  '#004C00', '#023B01', '#012E01', '#011D01', '#011301', '#011303'
];

// Paleta para NDWI
var waterPalette = [
  '#b5e22e', '#3ae237', '#86e26f', '#3ff38f', '#3be285',
  '#32d3ef', '#30c8e2', '#269db1', '#307ef3', '#235cb1',
  '#0602ff', '#0502e6', '#0502ce', '#0502b8', '#0502a3',
  '#040281', '#040274'
];

// Paleta para NBR
var firePalette = [
  '#ff0000', '#ff500d', '#ff6e08', '#ff8b13', '#ffb613',
  '#ffd611', '#fff705', '#d6e21f', '#b5e22e', '#3ae237', '#3ff38f',
  '#32d3ef', '#30c8e2', '#269db1', '#307ef3', '#235cb1'
];

// Paleta para NDMI
var moisturePalette = [
  '#ff0000', '#ff500d', '#ff6e08', '#ff8b13', '#ffb613',
  '#ffd611', '#fff705', '#d6e21f', '#b5e22e', '#3ae237', '#3ff38f',
  '#32d3ef', '#30c8e2', '#269db1', '#307ef3', '#235cb1'
];

var moisturePalette_ii = [
  '#235cb1', '#307ef3', '#269db1', '#30c8e2', '#32d3ef',
  '#3ff38f', '#3ae237', '#b5e22e', '#d6e21f', '#fff705',
  '#ffd611', '#ffb613', '#ff8b13', '#ff6e08', '#ff500d', '#ff0000'
];
// ==================================================================================================================
// 9. ADICIONAR CAMADAS AO MAPA
// ==================================================================================================================
// Configuração de parâmetros de visualização para cada índice
Map.addLayer(allIndices.select('NDVI').clip(study_area), {min: 0.019, max: 0.571, palette: vegPalette}, 'NDVI', false);
Map.addLayer(allIndices.select('EVI').clip(study_area), {min: -0.083, max: 0.701, palette: vegPalette}, 'EVI', false);
Map.addLayer(allIndices.select('GNDVI').clip(study_area), {min: 0.012, max: 0.508, palette: vegPalette}, 'GNDVI', false);
Map.addLayer(allIndices.select('NDWI').clip(study_area), {min: -0.190, max: 0.410, palette: waterPalette}, 'NDWI', false);
Map.addLayer(allIndices.select('SAVI').clip(study_area), {min: 0.008, max: 0.500, palette: vegPalette}, 'SAVI', false);
Map.addLayer(allIndices.select('GCI').clip(study_area), {min: 0.180, max: 2.000, palette: vegPalette}, 'GCI', false);
Map.addLayer(allIndices.select('ARVI').clip(study_area), {min: -0.004, max: 0.410, palette: vegPalette}, 'ARVI', false);
Map.addLayer(allIndices.select('GLI').clip(study_area), {min: -0.040, max: 0.097, palette: vegPalette}, 'GLI', false);
Map.addLayer(allIndices.select('NBR').clip(study_area), {min: -0.171, max: 0.411, palette: firePalette}, 'NBR', false);
Map.addLayer(allIndices.select('NDMI').clip(study_area), {min: -0.225, max: 0.252, palette: moisturePalette}, 'NDMI', false);
Map.addLayer(allIndices.select('MSI').clip(study_area), {min: 0.641, max: 1.515, palette: moisturePalette_ii}, 'MSI', false);
Map.addLayer(allIndices.select('NDBI').clip(study_area), {min: -0.24, max: 0.21, palette: ['#0000FF', '#FFFFFF', '#FF0000']}, 'NDBI', false);


// ==================================================================================================================
// 10. ESTATÍSTICAS DOS ÍNDICES NA ÁREA DE ESTUDO
// ==================================================================================================================
function calculateStatistics(image, indexName) {
  var stats = image.select(indexName).reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    }).combine({
      reducer2: ee.Reducer.minMax(),
      sharedInputs: true
    }),
    geometry: study_area,
    scale: 10,
    maxPixels: 1e9,
    bestEffort: true
  });
  
  print(indexName + ':');
  print('  Média:', stats.get(indexName + '_mean'));
  print('  Desvio Padrão:', stats.get(indexName + '_stdDev'));
  print('  Mínimo:', stats.get(indexName + '_min'));
  print('  Máximo:', stats.get(indexName + '_max'));
}

// Calcular estatísticas para os seguinte índices
calculateStatistics(allIndices, 'NDVI');
calculateStatistics(allIndices, 'EVI');
calculateStatistics(allIndices, 'GLI');

// ==================================================================================================================
// 11. GRÁFICOS (HISTOGRAMAS)
// ==================================================================================================================
// Histograma do NDVI
var ndviHistogram = ui.Chart.image.histogram({
  image: allIndices.select('NDVI'),
  region: study_area,
  scale: 10,
  maxPixels: 1e9
});
ndviHistogram.setOptions({
  title: 'NDVI - Distribuição dos Valores',
  hAxis: {title: 'NDVI', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'Frequência', titleTextStyle: {italic: false, bold: true}},
  colors: ['#008000'],
  legend: {position: 'none'}
});
print('Histograma do NDVI:', ndviHistogram);

// Histograma do EVI
var msiHistogram = ui.Chart.image.histogram({
  image: allIndices.select('EVI'),
  region: study_area,
  scale: 10,
  maxPixels: 1e9
});
msiHistogram.setOptions({
  title: 'EVI - Distribuição dos Valores',
  hAxis: {title: 'EVI', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'Frequência', titleTextStyle: {italic: false, bold: true}},
  colors: ['#F37413'],
  legend: {position: 'none'}
});
print('Histograma do EVI:', msiHistogram);


// ==================================================================================================================
// 12. EXPORTAÇÃO DOS RESULTADOS
// ==================================================================================================================
// Exportar mosaico RGB
Export.image.toDrive({
  image: mosaic.clip(study_area),
  description: 'SENTINEL2_RGB_MOSAIC',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Indices_Espectrais'
});

// Exportar todos os índices como uma imagem multicanal
Export.image.toDrive({
  image: allIndices.clip(study_area),
  description: 'TODOS_INDICES_ESPECTRAIS',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Indices_Espectrais'
});

// Exportar NDVI específico
Export.image.toDrive({
  image: allIndices.select('NDVI').clip(study_area),
  description: 'NDVI_SENTINEL2',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Indices_Espectrais'
});
