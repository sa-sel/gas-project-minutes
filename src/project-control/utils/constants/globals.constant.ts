import { DialogTitle, GS, Spreadsheet, alert } from '@lib';

/** The project control spreadsheet namespace. */
export class PCGS {
  private static ssCache: Spreadsheet;

  /** The whole spreadsheet. */
  static get ss(): Spreadsheet | null {
    if (this.ssCache !== undefined) {
      return this.ssCache;
    }

    const projectDir = DriveApp.getFileById(GS.doc.getId()).getParents().next().getParents().next();
    const projectNameEdition = GS.doc.getName().replace(/.+? - (.+)/, '$1');
    const projectControlName = `Controle de Projeto - ${projectNameEdition}`;
    const projectControlIt = projectDir.getFilesByName(projectControlName);

    if (projectControlIt.hasNext()) {
      const projectControlFile = projectControlIt.next();

      if (projectControlFile.getMimeType() === MimeType.GOOGLE_SHEETS) {
        this.ssCache = SpreadsheetApp.openById(projectControlFile.getId());

        return this.ssCache;
      }
    }

    alert({
      title: DialogTitle.Error,
      body:
        `Não foi possível encontrar e abrir a planilha de controle do projeto (arquivo buscado: "${projectControlName}"), portanto a ` +
        'ata não será enviada por email.\nIMPORTANTE: Entre em contato com a Diretoria de Tecnologia para resolver o problema.',
    });
    this.ssCache = null;

    return this.ssCache;
  }
}
