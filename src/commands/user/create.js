const { UserCommand } = require('@eartharoid/dbf');
const { replyPanelsOnly } = require('../../lib/tickets/utils');

module.exports = class CreateUserCommand extends UserCommand {
	constructor(client, options) {
		const nameLocalizations = {};
		client.i18n.locales.forEach(l => (nameLocalizations[l] = client.i18n.getMessage(l, 'commands.user.create.name')));

		super(client, {
			...options,
			dmPermission: false,
			name: nameLocalizations['en-GB'],
			nameLocalizations,
		});
	}

	/**
	 * @param {import("discord.js").UserContextMenuCommandInteraction} interaction
	 */
	async run(interaction) {
		await replyPanelsOnly(this.client, interaction);
	}
};
