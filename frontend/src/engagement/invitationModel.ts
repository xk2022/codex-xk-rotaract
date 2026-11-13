import { businessInstant, type BusinessActor, type BusinessCompany, type BusinessMember } from '../phase3/businessModel';

export interface MaintainerInvitation {
    id: string; companyId: string; companyName: string; ownerId: string; inviteeId: string;
    status: 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'revoked';
    version: number; createdAt: string; updatedAt: string;
}
export type InvitationAction = { type: 'invite'; actor: BusinessActor; companyId: string; companyVersion: number; inviteeId: string }
    | { type: 'accept' | 'reject' | 'cancel'; actor: BusinessActor; id: string; version: number; companyVersion: number }
    | { type: 'revoke'; actor: BusinessActor; companyId: string; companyVersion: number; memberId: string };
export type InvitationResult = { ok: true; companies: BusinessCompany[]; invitations: MaintainerInvitation[] } | { ok: false; error: string };

export function applyInvitationAction(companies: BusinessCompany[], invitations: MaintainerInvitation[], action: InvitationAction,
    context: { members: BusinessMember[]; asOf: string }, random: () => string = () => crypto.randomUUID()): InvitationResult {
    const fail = (error: string): InvitationResult => ({ ok: false, error });
    const actor = action.actor;
    if (!actor.memberId || actor.role === 'content_admin' || !context.members.some(m => m.id === actor.memberId)) return fail('請使用本人會員身分操作；內容管理者不具有公司維護授權。');
    const instant = businessInstant(context.asOf);
    if (!Number.isFinite(instant)) return fail('情境時間無效，請重新選擇。');
    const at = new Date(instant).toISOString();
    const invitation = 'id' in action ? invitations.find(i => i.id === action.id) : undefined;
    if ('id' in action && !invitation) return fail('找不到維護邀請。');
    const company = companies.find(c => c.id === ('companyId' in action ? action.companyId : invitation!.companyId));
    if (!company) return fail('找不到公司。');
    if (company.version !== action.companyVersion || (invitation && 'version' in action && invitation.version !== action.version)) return fail('資料版本已更新，請重新確認後操作。');
    if (invitation && invitation.ownerId !== company.ownerId) return fail('公司建立者已變更，邀請無法使用。');
    if (invitation && businessInstant(invitation.updatedAt) > instant) return fail('情境時間早於邀請建立時間。');
    const owned = company.ownerId === actor.memberId;
    let nextCompany = company;
    let nextInvitations: MaintainerInvitation[];
    if (action.type === 'invite') {
        if (!owned) return fail('僅公司建立者可以邀請共同維護者。');
        if (!context.members.some(m => m.id === action.inviteeId)) return fail('請選擇已註冊的會員。');
        if (action.inviteeId === company.ownerId) return fail('無法邀請公司建立者本人。');
        if (company.acceptedMaintainerIds.includes(action.inviteeId)) return fail('該會員已是共同維護者。');
        if (invitations.some(i => i.companyId === company.id && i.inviteeId === action.inviteeId && i.status === 'pending')) return fail('該會員已有待回覆邀請。');
        const id = random();
        if (!id || invitations.some(i => i.id === id)) return fail('邀請識別碼重複，請重試。');
        nextInvitations = [...invitations, { id, companyId: company.id, companyName: company.name, ownerId: company.ownerId, inviteeId: action.inviteeId, status: 'pending', version: 1, createdAt: at, updatedAt: at }];
    } else if (action.type === 'revoke') {
        if (!owned) return fail('僅公司建立者可以撤銷共同維護權。');
        if (action.memberId === company.ownerId || !company.acceptedMaintainerIds.includes(action.memberId)) return fail('該會員不是可撤銷的共同維護者。');
        if (invitations.some(i => i.companyId === company.id && i.inviteeId === action.memberId && i.status === 'accepted' && businessInstant(i.updatedAt) > instant)) return fail('情境時間早於接受邀請時間。');
        nextCompany = { ...company, acceptedMaintainerIds: company.acceptedMaintainerIds.filter(id => id !== action.memberId), version: company.version + 1 };
        nextInvitations = invitations.map(i => i.companyId === company.id && i.inviteeId === action.memberId && i.status === 'accepted' ? { ...i, status: 'revoked', version: i.version + 1, updatedAt: at } : i);
    } else {
        if (invitation!.status !== 'pending') return fail('邀請已處理，無法重複操作。');
        if (action.type === 'cancel' ? !owned : invitation!.inviteeId !== actor.memberId) return fail(action.type === 'cancel' ? '僅公司建立者可以取消邀請。' : '僅受邀會員本人可以回覆邀請。');
        if (action.type === 'accept') {
            if (company.status === 'suspended') return fail('公司已暫停，暫時無法接受邀請。');
            if (company.acceptedMaintainerIds.includes(actor.memberId) || company.ownerId === actor.memberId) return fail('該帳號已具有公司維護權。');
            nextCompany = { ...company, acceptedMaintainerIds: [...company.acceptedMaintainerIds, actor.memberId], version: company.version + 1 };
        }
        const status = action.type === 'accept' ? 'accepted' : action.type === 'reject' ? 'rejected' : 'cancelled';
        nextInvitations = invitations.map(i => i.id === invitation!.id ? { ...i, status, version: i.version + 1, updatedAt: at } : i);
    }
    return { ok: true, companies: nextCompany === company ? companies : companies.map(c => c.id === company.id ? nextCompany : c), invitations: nextInvitations };
}

export function projectInvitations(invitations: MaintainerInvitation[], actor: BusinessActor): MaintainerInvitation[] {
    if (!actor.memberId || actor.role === 'content_admin') return [];
    return invitations.filter(i => i.ownerId === actor.memberId || i.inviteeId === actor.memberId).map(i => ({
        id: i.id, companyId: i.companyId, companyName: i.companyName, ownerId: i.ownerId, inviteeId: i.inviteeId,
        status: i.status, version: i.version, createdAt: i.createdAt, updatedAt: i.updatedAt,
    }));
}
