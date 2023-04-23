import {
  DialogTitle,
  DiscordEmbed,
  DiscordWebhook,
  File,
  GS,
  MeetingVariable,
  SafeWrapper,
  SheetLogger,
  alert,
  confirm,
  exportToPdf,
  sendEmail,
  substituteVariablesInFile,
  substituteVariablesInString,
} from '@lib';
import { Project } from '@project-control/utils/classes';
import { NamedRange, PCGS } from '@project-control/utils/constants';
import { getAllMembers, getNamedValue } from '@project-control/utils/functions';

// TODO: how to use "@views/" here?
import emailBodyHtml from '../views/finish-meeting.email.html';

const dialogBody = `
Você tem certeza que deseja continuar com essa ação? Ela é irreversível e vai:
  - Exportar a ata da reunião para PDF;
  - Enviar o PDF da ata por email para os membros;
  - Enviar a ata nos canais do Discord do projeto (caso webhook esteja configurado) e da diretoria;
  - Excluir o documento editável da ata.
`;

const buildProjectDiscordEmbeds = (project: Project, meetingMinutes: File, meetingEnd: Date): DiscordEmbed[] => {
  const fields: DiscordEmbed['fields'] = [];

  fields.pushIf(project.director, { name: 'Direção', value: project.director?.toString(), inline: true });
  fields.pushIf(project.manager, { name: 'Gerência', value: project.manager?.toString(), inline: true });

  return [
    {
      title: `Reunião de Projeto`,
      url: meetingMinutes.getUrl(),
      timestamp: meetingEnd.toISOString(),
      fields,
      author: {
        name: project.toString(),
        url: project.folder?.getUrl(),
      },
    },
  ];
};

export const actuallyFinishMeeting = (meetingEnd: Date, logger?: SheetLogger, teamEmails?: string[]) => {
  const minutesDocFile = substituteVariablesInFile(DriveApp.getFileById(GS.doc.getId()), {
    [MeetingVariable.End]: meetingEnd.asTime(),
  });

  logger?.log(DialogTitle.InProgress, `Horário de fim da reunião registrado: ${meetingEnd.asTimestamp()}`);

  const minutesPdf = exportToPdf(minutesDocFile).moveTo(minutesDocFile.getParents().next());
  const project = Project.spreadsheetFactory();

  logger?.log(DialogTitle.InProgress, 'PDF da ata exportado.');

  if (project) {
    if (teamEmails?.length) {
      sendEmail({
        subject: `[SA-SEL] Reunião "${project.name} (${project.edition})" - ${meetingEnd.asDateString()}`,
        target: teamEmails,
        htmlBody: substituteVariablesInString(emailBodyHtml, project.templateVariables),
        attachments: [minutesPdf],
      });

      logger?.log(DialogTitle.InProgress, 'Ata enviada por email para os membros.');
    }

    const boardWebhook = new DiscordWebhook(getNamedValue(NamedRange.WebhookBoardOfDirectors));
    const generalWebhook = new DiscordWebhook(getNamedValue(NamedRange.WebhookProject));
    const embeds: DiscordEmbed[] = buildProjectDiscordEmbeds(project, minutesPdf, meetingEnd);

    boardWebhook.post({ embeds });
    generalWebhook.post({ embeds });

    if (boardWebhook.url.isUrl() || generalWebhook.url.isUrl()) {
      logger?.log(DialogTitle.InProgress, 'Ata enviada no Discord.');
    }
  }

  alert({
    title: DialogTitle.Success,
    body: `Ata exportada para PDF com sucesso, o documento editável será excluído. Link:\n${minutesPdf.getUrl()}`,
  });
  logger?.log(DialogTitle.Success, 'Ata exportada para PDF com sucesso, documento editável será excluído');
  minutesDocFile.setTrashed(true);
};

export const finishMeeting = () =>
  SafeWrapper.factory(finishMeeting.name, {
    loggingSheet: () => PCGS.ss?.getSheetByName('Logs'),
    allowedEmails: () => (PCGS.ss ? getAllMembers().map(m => m.email) : null),
  }).wrap((logger, auth) => {
    const meetingEnd = new Date();

    confirm(
      {
        title: `Conclusão de Reunião - ${meetingEnd.asDateString()}`,
        body: dialogBody,
      },
      () => actuallyFinishMeeting(meetingEnd, logger, auth?.allowedEmails),
      logger,
    );
    logger?.log(DialogTitle.InProgress, `Execução iniciada para reunião de ${meetingEnd.asDateString()}`);
  });
