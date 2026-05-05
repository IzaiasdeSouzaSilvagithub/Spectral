/* ==================================================================================================================
ÍNDICES ESPECTRAIS COMUMENTE UTILIZADOS NO ESTUDO DOS SISTEMAS AQUÁTICOS
=====================================================================================================================
OBJETIVO: Demonstrar como calcular índices espectrais para delimitar corpos d'água e analisar sua qualidade.

O código cobre:
1. Calcular NDWI e MNDWI para delimitar o corpo hídrico
2. Filtrar apenas o que é água usando NDWI
3. Aplicar NDCI (Clorofila) e NDTI (Turbidez) APENAS na região de água
4. Plotar histogramas do NDCI e NDTI

ÍNDICES UTILIZADOS:
- NDWI (Gao, 1996): (GREEN - NIR) / (GREEN + NIR) -> Delimitação de água
- MNDWI (Xu, 2006): (GREEN - SWIR1) / (GREEN + SWIR1) -> Melhor para áreas urbanas
- NDCI (Mishra & Mishra, 2012): (RED EDGE - RED) / (RED EDGE + RED) -> Clorofila (algas)
- NDTI (Lacaux et al., 2007): (RED - GREEN) / (RED + GREEN) -> Turbidez

REFERÊNCIAS:
- NDWI: McFeeters (1996) - International Journal of Remote Sensing
- MNDWI: Xu (2006) - International Journal of Remote Sensing  
- NDCI: Mishra & Mishra (2012) - Remote Sensing of Environment
- NDTI: Lacaux et al. (2007) - Remote Sensing of Environment
===================================================================================================================== */

// ==================================================================================================================
// 1. DEFINIR ÁREA DE ESTUDO (ROI)
// ==================================================================================================================
// Para este exemplo, usaremos uma área com corpo d'água (represa, lago ou rio)
var study_area = geometry;


// ==================================================================================================================
// 2. CENTRALIZAR MAPA E CONFIGURAR VISUALIZAÇÃO
// ==================================================================================================================
Map.centerObject(study_area, 12);
Map.addLayer(study_area, {color: 'yellow'}, 'AREA DE ESTUDO (ROI)', false);


// ==================================================================================================================
// 3. FUNÇÃO PARA REMOVER NUVENS (SENTINEL-2)
// ==================================================================================================================
/* IMPORTANTE: Para imagens de 2026, use a banda QA60
   
   A banda QA60 contém informações sobre nuvens e cirrus:
   - Bit 10: Nuvens opacas (Opaque clouds)
   - Bit 11: Nuvens Cirrus (Cirrus clouds)
   
   Valor 0 no bit indica ausência de nuvens.
   A divisão por 10000 converte os valores para reflectância (0-1).
   ================================================================================================================== */

function removeClouds(image) {
  // Selecionar a banda QA60 (disponível para 2026)
  var qa = image.select('QA60');
  
  // Bits 10 e 11 representam nuvens e cirrus, respectivamente
  var cloudBitMask = 1 << 10;   // Bit 10: Nuvens opacas
  var cirrusBitMask = 1 << 11;  // Bit 11: Nuvens cirrus
  
  // Criar máscara: TRUE onde NÃO há nuvens E NÃO há cirrus
  // Ou seja, ambos os bits devem ser 0
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
              .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  
  // Aplicar máscara e converter para reflectância (0-1)
  return image.updateMask(mask).divide(10000);
}


// ==================================================================================================================
// 4. ACESSAR E FILTRAR A COLEÇÃO SENTINEL-2
// ==================================================================================================================
var sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterDate('2025-07-01', '2025-07-31')
    .filterBounds(study_area)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10))
    .map(removeClouds);

var imageCount = sentinel2.size();
print('Quantidade de imagens encontradas:', imageCount);

// Criar mosaico usando mediana (remove ruídos)
var mosaic = sentinel2.median();
print('Bandas disponiveis:', mosaic.bandNames());


// ==================================================================================================================
// 5. VISUALIZACAO RGB DA AREA
// ==================================================================================================================
var rgbVis = {
  min: 0.0,
  max: 0.3,
  bands: ['B4', 'B3', 'B2'],
  gamma: 1.2
};

Map.addLayer(mosaic.clip(study_area), rgbVis, 'Imagem RGB', false);


// ==================================================================================================================
// 6. CALCULAR NDWI E MNDWI PARA DELIMITAR CORPOS D'AGUA
// ==================================================================================================================
// NDWI - Normalized Difference Water Index (McFeeters, 1996)
// Formula: (GREEN - NIR) / (GREEN + NIR)
// Valores positivos indicam agua, valores negativos indicam solo/vegetacao
var ndwi = mosaic.normalizedDifference(['B3', 'B8']).rename('NDWI');

// MNDWI - Modified Normalized Difference Water Index (Xu, 2006)
// Formula: (GREEN - SWIR1) / (GREEN + SWIR1)
// Melhor para diferenciar agua de areas urbanas construidas
var mndwi = mosaic.normalizedDifference(['B3', 'B11']).rename('MNDWI');


// ==================================================================================================================
// 7. APLICAR LIMIAR (THRESHOLD) PARA CRIAR MASCARA DE AGUA
// ==================================================================================================================
// Consideraremos que: agua > 0, solo/vegetacao <= 0
// Ajuste o limiar conforme sua região
var waterThreshold = 0.0;

// Criar máscara binária (1 = agua, 0 = nao agua)
var waterMaskBinary = ndwi.gte(waterThreshold).rename('water_mask');

// Aplicar a máscara para extrair APENAS os pixels de água
var waterOnly = mosaic.updateMask(waterMaskBinary);


// ==================================================================================================================
// 8. PALETAS DE CORES PARA VISUALIZACAO
// ==================================================================================================================
// Paleta para NDWI (valores baixos = seco, valores altos = agua)
var ndwiPalette = [
  '#b5e22e', '#3ae237', '#86e26f', '#3ff38f', '#3be285',
  '#32d3ef', '#30c8e2', '#269db1', '#307ef3', '#235cb1',
  '#0602ff', '#0502e6', '#0502ce', '#0502b8', '#0502a3',
  '#040281', '#040274'
];

// Paleta para máscara binária (preto = nao agua, azul = agua)
var binaryPalette = ['black', 'blue'];

// Paleta para NDCI 
var ndciPalette = ['#0000FF', '#1E90FF', '#00BFFF', '#00FA9A', '#32CD32', '#008000'];

// Paleta para NDTI
var ndtiPalette = ['#040274', '#307ef3', '#32d3ef', '#3be285', '#ffd611', '#ff6e08', '#ff0000'];


// ==================================================================================================================
// 9. VISUALIZAR NDWI E MASCARA DE AGUA
// ==================================================================================================================
Map.addLayer(mndwi.clip(study_area), {min: -0.5, max: 0.5, palette: ndwiPalette}, 'MNDWI', false);
Map.addLayer(ndwi.clip(study_area), {min: -0.5, max: 0.5, palette: ndwiPalette}, 'NDWI', false);
Map.addLayer(waterMaskBinary.clip(study_area), {palette: binaryPalette}, 'Mascara Binaria de Agua (NDWI >= 0)', false);
Map.addLayer(waterOnly.clip(study_area).select(['B12', 'B8A', 'B4']), {min: 0.002, max: 0.015, gamma: 1.0}, 'Apenas Corpo Hidrico', false);

// ==================================================================================================================
// 10. CALCULAR NDCI (NORMALIZED DIFFERENCE CHLOROPHYLL INDEX) APENAS NA AGUA
// ==================================================================================================================
// NDCI - Normalized Difference Chlorophyll Index (Mishra & Mishra, 2012)
// Formula: (RED EDGE - RED) / (RED EDGE + RED)
// Valores altos são indicaor de maior concentracao de clorofila (algas)
var ndci = mosaic.expression(
  '(RED_EDGE - RED) / (RED_EDGE + RED)', {
    'RED_EDGE': mosaic.select('B5'),  // B5 = Red Edge 1 (703nm)
    'RED': mosaic.select('B4')
}).rename('NDCI');

// Aplicar a mascara de agua para analisar APENAS os pixels aquaticos
var ndciWaterOnly = ndci.updateMask(waterMaskBinary);


// ==================================================================================================================
// 11. CALCULAR NDTI (NORMALIZED DIFFERENCE TURBIDITY INDEX) APENAS NA AGUA
// ==================================================================================================================
// NDTI - Normalized Difference Turbidity Index (Lacaux et al., 2007)
// Formula: (RED - GREEN) / (RED + GREEN)
// Valores altos são indicadores de maior turbidez na coluna d'água
var ndti = mosaic.expression(
  '(RED - GREEN) / (RED + GREEN)', {
    'RED': mosaic.select('B4'),
    'GREEN': mosaic.select('B3')
}).rename('NDTI');

// Aplicar a mascara de agua para analisar APENAS os pixels aquaticos
var ndtiWaterOnly = ndti.updateMask(waterMaskBinary);


// ==================================================================================================================
// 12. VISUALIZAR NDCI E NDTI NO CORPO HIDRICO
// ==================================================================================================================
Map.addLayer(ndciWaterOnly.clip(study_area), {min: -0.143, max: 0.051, palette: ndciPalette}, 'NDCI', false);
Map.addLayer(ndtiWaterOnly.clip(study_area), {min: -0.388, max: -0.223, palette: ndtiPalette}, 'NDTI', false);


// ==================================================================================================================
// 13. CALCULAR ESTATISTICAS DOS INDICES
// ==================================================================================================================
function calculateWaterStats(image, indexName, waterMask) {
  var stats = image.updateMask(waterMask).reduceRegion({
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
  
  print('  Media:', stats.get(indexName + '_mean'));
  print('  Desvio Padrao:', stats.get(indexName + '_stdDev'));
  print('  Minimo:', stats.get(indexName + '_min'));
  print('  Maximo:', stats.get(indexName + '_max'));
}

calculateWaterStats(ndci, 'NDCI', waterMaskBinary);
calculateWaterStats(ndti, 'NDTI', waterMaskBinary);


// ==================================================================================================================
// 14. CALCULAR AREA DO CORPO HIDRICO
// ==================================================================================================================
var waterArea = waterMaskBinary.multiply(ee.Image.pixelArea())
    .reduceRegion({
      reducer: ee.Reducer.sum(),
      geometry: study_area,
      scale: 10,
      maxPixels: 1e9
    });

var waterAreaHa = ee.Number(waterArea.get('water_mask')).divide(10000);
print('Area do corpo hidrico (hectares):', waterAreaHa);


// ==================================================================================================================
// 15. HISTOGRAMAS DO NDCI E NDTI
// ==================================================================================================================
// Histograma do NDCI
var ndciHistogram = ui.Chart.image.histogram({
  image: ndciWaterOnly,
  region: study_area,
  scale: 10,
  maxPixels: 1e9
});
ndciHistogram.setOptions({
  title: 'NDCI',
  hAxis: {title: 'NDCI (Clorofila)', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'Frequencia (Numero de Pixels)', titleTextStyle: {italic: false, bold: true}},
  colors: ['#006400'],
  legend: {position: 'none'},
  histogram: {bucketSize: 0.02}
});
print('Grafico 1: Histograma do NDCI:', ndciHistogram);

// Histograma do NDTI
var ndtiHistogram = ui.Chart.image.histogram({
  image: ndtiWaterOnly,
  region: study_area,
  scale: 10,
  maxPixels: 1e9
});
ndtiHistogram.setOptions({
  title: 'NDTI',
  hAxis: {title: 'NDTI', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'Frequencia (Numero de Pixels)', titleTextStyle: {italic: false, bold: true}},
  colors: ['#FF8C00'],
  legend: {position: 'none'},
  histogram: {bucketSize: 0.02}
});
print('Grafico 2: Histograma do NDTI:', ndtiHistogram);


// ==================================================================================================================
// 19. EXPORTACAO DOS RESULTADOS
// ==================================================================================================================
// Exportar mascara de agua
Export.image.toDrive({
  image: waterMaskBinary,
  description: 'Water_Mask_NDWI',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Water'
});

// Exportar NDCI
Export.image.toDrive({
  image: ndciWaterOnly,
  description: 'NDCI',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Water'
});

// Exportar NDTI
Export.image.toDrive({
  image: ndtiWaterOnly,
  description: 'NDTI',
  scale: 10,
  region: study_area,
  maxPixels: 1e9,
  folder: 'GEE_Water'
});
