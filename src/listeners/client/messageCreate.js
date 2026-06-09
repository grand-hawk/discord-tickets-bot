const { Listener } = require('@eartharoid/dbf');
const {
	ChannelType,
	EmbedBuilder,
} = require('discord.js');
const { isStaff } = require('../../lib/users');
const ms = require('ms');

module.exports = class extends Listener {
	constructor(client, options) {
		super(client, {
			...options,
			emitter: client,
			event: 'messageCreate',
		});
	}

	/**
	 * @param {import("discord.js").Message} message
	 */
	async run(message) {
		/** @type {import("client")} */
		const client = this.client;

		if (message.channel.type !== ChannelType.DM) {
			const settings = await client.prisma.guild.findUnique({ where: { id: message.guild.id } });
			if (!settings) return;
			const getMessage = client.i18n.getLocale(settings.locale);
			let ticket = await client.prisma.ticket.findUnique({ where: { id: message.channel.id } });

			if (ticket) {
				// archive messages
				if (settings.archive) {
					client.tickets.archiver.saveMessage(ticket.id, message)
						.catch(error => {
							client.log.warn('Failed to archive message', message.id);
							client.log.error(error);
							message.react('❌').catch(client.log.error);
						});
				}

				if (!message.author.bot) {
					// update user's message count
					client.prisma.user.upsert({
						create: {
							id: message.author.id,
							messageCount: 1,
						},
						update: { messageCount: { increment: 1 } },
						where: { id: message.author.id },
					}).catch(client.log.error);

					// set first and last message timestamps
					const data = { lastMessageAt: new Date() };
					if (
						ticket.firstResponseAt === null &&
						await isStaff(message.guild, message.author.id)
					) data.firstResponseAt = new Date();
					ticket = await client.prisma.ticket.update({
						data,
						where: { id: ticket.id },
					});

					// if the ticket was set as stale, unset it
					if (client.tickets.$stale.has(ticket.id)) {
						const $ticket = client.tickets.$stale.get(ticket.id);
						$ticket.messages++;
						if ($ticket.messages >= 1) {
							await message.channel.messages.delete($ticket.message.id);
							client.tickets.$stale.delete(ticket.id);
						} else {
							client.tickets.$stale.set(ticket.id, $ticket);
						}
					}
				}

				if (process.env.PUBLIC_BOT !== 'true' &&
					!message.author.bot &&
					!await isStaff(message.channel.guild, message.author.id)
				) {
					const key = `offline/${message.channel.id}`;
					let online = 0;
					for (const [, member] of message.channel.members) {
						if (member.user.bot) continue;
						if (!await isStaff(message.channel.guild, member.id)) continue;
						if (member.presence && member.presence !== 'offline') online++;
					}
					if (online === 0 && ! await client.keyv.has(key)) {
						await message.channel.send({
							embeds: [
								new EmbedBuilder()
									.setColor(settings.primaryColour)
									.setTitle(getMessage('ticket.offline.title'))
									.setDescription(getMessage('ticket.offline.description')),
							],
						});
						client.keyv.set(key, Date.now(), ms('1h'));
					}
				}
			}

			// auto-tag
			if (
				!message.author.bot &&
				(
					(settings.autoTag === 'all') ||
					(settings.autoTag === 'ticket' && ticket) ||
					(settings.autoTag === '!ticket' && !ticket) ||
					(settings.autoTag.includes(message.channel.id))
				)
			) {
				const cacheKey = `cache/guild-tags:${message.guild.id}`;
				let tags = await client.keyv.get(cacheKey);
				if (!tags) {
					tags = (await client.prisma.tag.findMany({
						select: {
							content: true,
							id: true,
							name: true,
							regex: true,
						},
						where: { guildId: message.guild.id },
					}))
						.sort((a, b) => (b.regex ? b.regex.length : 0) - (a.regex ? a.regex.length : 0));
					client.keyv.set(cacheKey, tags, ms('1h'));
				}

				const tag = tags.find(tag => tag.regex && message.content.match(new RegExp(tag.regex, 'mi')));
				if (tag) {
					await message.reply({
						embeds: [
							new EmbedBuilder()
								.setColor(settings.primaryColour)
								.setDescription(tag.content),
						],
					});
				}

			}
		}
	}
};
