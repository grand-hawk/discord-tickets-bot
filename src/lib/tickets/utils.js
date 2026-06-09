const {
	EmbedBuilder,
	MessageFlags,
} = require('discord.js');

/**
 * @param {import("discord.js").Interaction} interaction
 */
function isPanelCreateInteraction(interaction) {
	if (!interaction.isButton() && !interaction.isStringSelectMenu()) return false;
	const { message } = interaction;
	if (!message || message.flags.has(MessageFlags.Ephemeral)) return false;
	return message.embeds.length > 0;
}

/**
 * @param {import("client")} client
 * @param {import("discord.js").Interaction} interaction
 */
async function replyPanelsOnly(client, interaction) {
	let settings;
	if (interaction.guild?.id) {
		settings = await client.prisma.guild.findUnique({
			select: {
				errorColour: true,
				footer: true,
				locale: true,
			},
			where: { id: interaction.guild.id },
		});
	}
	const getMessage = client.i18n.getLocale(settings?.locale ?? 'en-GB');
	const embed = new EmbedBuilder()
		.setColor(settings?.errorColour ?? 'Red')
		.setTitle(getMessage('misc.panels_only.title'))
		.setDescription(getMessage('misc.panels_only.description'));
	if (settings?.footer && interaction.guild) {
		embed.setFooter({
			iconURL: interaction.guild.iconURL(),
			text: settings.footer,
		});
	}
	const payload = {
		components: [],
		embeds: [embed],
		flags: MessageFlags.Ephemeral,
	};
	if (interaction.replied || interaction.deferred) {
		await interaction.editReply(payload);
	} else {
		await interaction.reply(payload);
	}
}

module.exports = {
	isPanelCreateInteraction,
	replyPanelsOnly,
};
