# Dependencias locales de PDF

Se cargan bajo demanda al pulsar «Descargar PDF completo». No usan un CDN en producción ni envían los datos del reporte a un servicio externo.

| Archivo | Fuente oficial | SHA-256 |
| --- | --- | --- |
| `jspdf-4.2.1.umd.min.js` | https://raw.githubusercontent.com/parallax/jsPDF/v4.2.1/dist/jspdf.umd.min.js | `e6551fcdc32f09d6853b2c5126d18d01d9447e0da618a41a11ebeee0f6c20d54` |
| `jspdf-autotable-5.0.7.min.js` | https://raw.githubusercontent.com/simonbengtsson/jsPDF-AutoTable/v5.0.7/dist/jspdf.plugin.autotable.min.js | `238db5fea9fe231d70d80a108b5193821d618056c97f23821899265370531c94` |

Licencias MIT adjuntas. Se conservan los archivos minificados originales. El exportador usa texto y tablas, no importación HTML ni imágenes remotas.

Documentación: https://github.com/parallax/jsPDF y https://github.com/simonbengtsson/jsPDF-AutoTable.
