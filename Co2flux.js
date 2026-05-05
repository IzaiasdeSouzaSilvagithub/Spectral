/* ==================================================================================================================
CO2flux - O CO₂flux é um indicador do sequestro de carbono pela vegetação que integra, 
por meio de produto matemático, o Índice de Vegetação por Diferença Normalizada (NDVI), 
o qual quantifica o vigor vegetativo e a biomassa fotossinteticamente ativa, 
com o Índice de Reflectância Fotoquímica (PRI) reescalonado (sPRI), 
que mede a eficiência do uso da luz no processo fotossintético 
através da estimativa do estado do ciclo das xantofilas, 
permitindo assim estimar indiretamente a taxa de assimilação líquida de CO₂ pelos ecossistemas vegetais,
em diferentes escalas espaço-temporais.
=====================================================================================================================

BASE CIENTÍFICA:
- Rahman et al. (2000): Propôs o modelo CO2flux = NDVI × sPRI para estimar fluxo de CO2 em florestas boreais
- Baptista (2003/2004): Validou o modelo para ambiente tropical de Cerrado usando dados AVIRIS e Hyperion
- Souza (2021) e Silva & Faria (2022): Aplicaram com sucesso em manguezais usando Sentinel-2/MSI

FÓRMULA COMPLETA:
CO2flux = NDVI × sPRI

Onde:
- NDVI (Rouse et al., 1973): (NIR - RED) / (NIR + RED) → vigor vegetativo
- PRI (Gamon et al., 1992): (GREEN - BLUE) / (GREEN + BLUE) → eficiência fotossintética
- sPRI (PRI reescalonado): (PRI + 1) / 2 → evita valores negativos

INTERPRETAÇÃO:
- Valores mais altos = maior sequestro de carbono / vegetação mais saudável
- Valores mais baixos = menor atividade fotossintética / vegetação estressada.

REFERÊNCIAS:
- Rahman et al. (2000) - AVIRIS Workshop, JPL/NASA
- Baptista, G.M.M. (2004) - GEOGRAFIA, v. 29, n. 2, p. 189-202
- Silva & Faria (2022) - Sociedade & Natureza, v. 34
===================================================================================================================== */

// ==================================================================================================================
// 1. DEFINIR ÁREA DE ESTUDO (ROI)
// ==================================================================================================================
var study_area = geometry;


// ==================================================================================================================
// 2. CENTRALIZAR MAPA
// ==================================================================================================================
Map.centerObject(study_area, 15);
Map.addLayer(study_area, {color: 'yellow'}, 'Área de Estudo', false);


// ==================================================================================================================
// 3. FUNÇÃO PARA REMOVER NUVENS (SENTINEL-2)
// ==================================================================================================================
/* 
   A banda QA60 contém informações sobre nuvens e cirrus:
   - Bit 10: Nuvens opacas (Opaque clouds)
   - Bit 11: Nuvens Cirrus (Cirrus clouds)
   
   Valor 0 no bit indica ausência de nuvens.
   A divisão por 10000 converte os valores para reflectância (0-1).
*/
function removeClouds(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
              .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask).divide(10000);
}

// ==================================================================================================================
// 4. CARREGAR COLEÇÃO SENTINEL-2 HARMONIZED
// ==================================================================================================================
var collection = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
    .filterBounds(study_area)
    .filterDate('2026-01-01', '2026-04-30')  // Período de interesse
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10));  // Máximo 10% nuvens

var imageCount = collection.size();
print('Quantidade de imagens encontradas:', imageCount);


// ==================================================================================================================
// 5. SELECIONAR UMA IMAGEM DE DATA ÚNICA/ESPECÍFICA
// ==================================================================================================================
/* Em vez de usar mediana, selecionamos a imagem com menos nuvens
   Ou a primeira imagem disponível no período
*/

// Opção 1: Selecionar a imagem com menos nuvens
var image = collection.sort('CLOUDY_PIXEL_PERCENTAGE').first();

// Opção 2: Selecionar uma imagem por ID específico (descomente e use o ID desejado)
// var image = ee.Image('COPERNICUS/S2_SR_HARMONIZED/20240715T123456_20240715T124059_T22KFG');

// Opção 3: Selecionar a primeira imagem da coleção (a imagem mais antiga do período)
// var image = collection.first();

// Opção 4: Selecionar a imagem mais recente
// var image = collection.sort('CLOUDY_PIXEL_PERCENTAGE', false).first();

// Aplicar máscara de nuvens na imagem selecionada
var imageMasked = removeClouds(image).clip(study_area);

// Obter data da imagem selecionada
var imageDate = image.date().format('YYYY-MM-dd');
print('Data da imagem selecionada:', imageDate);
print('ID da imagem:', image.id());
print('Percentual de nuvens:', image.get('CLOUDY_PIXEL_PERCENTAGE'));
print('Bandas disponíveis:', imageMasked.bandNames());


// ==================================================================================================================
// 6. CONFIGURAÇÃO DE VISUALIZAÇÃO RGB
// ==================================================================================================================
var rgbVis = {
  min: 0.0,
  max: 0.25,
  bands: ['B4', 'B3', 'B2'],
  gamma: 1.2
};

Map.addLayer(imageMasked, rgbVis, 'RGB - Imagem Sentinel-2 (' + imageDate.getInfo() + ')', false);


// ==================================================================================================================
// 7. CALCULAR O NDVI
// ==================================================================================================================
/* NDVI (Rouse et al., 1973)
   Fórmula: (NIR - RED) / (NIR + RED)
   Onde: NIR = B8 (Sentinel-2), RED = B4
*/
var ndvi = imageMasked.normalizedDifference(['B8', 'B4']).rename('NDVI');


// ==================================================================================================================
// 8. CALCULAR PRI - PHOTOCHEMICAL REFLECTANCE INDEX
// ==================================================================================================================
/* PRI (Gamon et al., 1992)
   Fórmula: (GREEN - BLUE) / (GREEN + BLUE)
   Onde: GREEN = B3, BLUE = B2 (Sentinel-2)
*/
var pri = imageMasked.normalizedDifference(['B3', 'B2']).rename('PRI');


// ==================================================================================================================
// 9. CALCULAR sPRI - PRI REESCALONADO
// ==================================================================================================================
/* sPRI (PRI reescalonado)
   Fórmula: (PRI + 1) / 2
   Objetivo: Evitar valores negativos
*/
var spri = pri.add(1).divide(2).rename('sPRI');


// ==================================================================================================================
// 10. CALCULAR CO2flux - ÍNDICE DE SEQÜESTRO DE CARBONO
// ==================================================================================================================
/* CO2flux (Rahman et al., 2000; Baptista, 2004)
   Fórmula: CO2flux = NDVI × sPRI
*/
var co2flux = ndvi.multiply(spri).rename('CO2flux');


// ==================================================================================================================
// 11. PALETAS DE CORES
// ==================================================================================================================
// Paleta para NDVI (vermelho = baixa vegetação, verde = alta vegetação)
var ndviPalette = ['#ff0000', '#ff6e08', '#ffd611', '#b5e22e', '#3ae237', '#008000'];

// Paleta para PRI (vermelho = baixa eficiência, verde = alta eficiência)
var priPalette = ['#ff0000', '#ff6e08', '#ffd611', '#b5e22e', '#3ae237', '#008000'];

// Paleta para CO2flux (vermelho = baixo sequestro, verde = alto sequestro)
var co2fluxPalette = [
  '#ff0000',
  '#ff6e08',
  '#ffd611',
  '#b5e22e',
  '#3ae237',
  '#008000'
];


// ==================================================================================================================
// 12. ADICIONAR AS CAMADAS AO MAPA
// ==================================================================================================================
Map.addLayer(ndvi.clip(study_area), 
  {min: -0.03, max: 0.70, palette: ndviPalette}, 
  'NDVI - Vigor Vegetativo (' + imageDate.getInfo() + ')', false);

Map.addLayer(pri.clip(study_area), 
  {min: -0.07, max: 0.50, palette: priPalette}, 
  'PRI - Eficiência Fotossintética (' + imageDate.getInfo() + ')', false);

Map.addLayer(spri.clip(study_area), 
  {min: 0.45, max: 0.75, palette: priPalette}, 
  'sPRI - PRI Reescalonado (' + imageDate.getInfo() + ')', false);

Map.addLayer(co2flux.clip(study_area), 
  {min: -0.20, max: 0.80, palette: co2fluxPalette}, 
  'CO₂flux - Sequestro de Carbono (' + imageDate.getInfo() + ')', true);


// ==================================================================================================================
// 13. ESTATÍSTICAS DO CO2flux NA ÁREA DE ESTUDO
// ==================================================================================================================
print('Data da imagem:', imageDate.getInfo());
var co2fluxStats = co2flux.reduceRegion({
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

print('Média do CO₂flux:', co2fluxStats.get('CO2flux_mean'));
print('Desvio Padrão:', co2fluxStats.get('CO2flux_stdDev'));
print('Mínimo:', co2fluxStats.get('CO2flux_min'));
print('Máximo:', co2fluxStats.get('CO2flux_max'));


// ==================================================================================================================
// 14. HISTOGRAMA DOS VALORES DO CO2flux
// ==================================================================================================================
var co2fluxHistogram = ui.Chart.image.histogram({
  image: co2flux,
  region: study_area,
  scale: 10,
  maxPixels: 1e9
});

co2fluxHistogram.setOptions({
  title: 'CO₂flux (' + imageDate.getInfo() + ')',
  hAxis: {title: 'CO₂flux', titleTextStyle: {italic: false, bold: true}},
  vAxis: {title: 'Frequência (Número de Pixels)', titleTextStyle: {italic: false, bold: true}},
  colors: ['#008000'],
  legend: {position: 'none'},
  histogram: {bucketSize: 0.02}
});
print('Gráfico: Histograma do CO₂flux:', co2fluxHistogram);


// ==================================================================================================================
// 17. EXPORTAÇÃO DOS RESULTADOS
// ==================================================================================================================
// Exportar CO2flux
Export.image.toDrive({
  image: co2flux,
  description: 'CO2flux_Sequestro_Carbono_' + imageDate.getInfo(),
  folder: 'CO2flux_Analysis',
  region: study_area,
  scale: 10,
  maxPixels: 1e9,
  crs: 'EPSG:31982'
});
