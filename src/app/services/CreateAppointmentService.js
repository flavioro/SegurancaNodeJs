import { startOfHour, parseISO, isBefore, format } from 'date-fns';
import pt from 'date-fns/locale/pt';

import User from '../models/User';
import Appointment from '../models/Appointment';

import Notification from '../schemas/Notification';

import Cache from '../../lib/Cache';

class CreateAppointmentService {
  async run({ provider_id, user_id, date }) {
    /**
     * Check if provider_id is a provider
     */
    const checkIsProvider = await User.findOne({
      where: { id: provider_id, provider: true }
    });

    if (!checkIsProvider) {
      throw new Error('You can only create appointments with providers');
    }
    /**
     * Check for past dates
     * parseISO transfom in objetc date
     * startOfHour get only hour and not minutes (19:30 to 19:00)
     */
    const hourStart = startOfHour(parseISO(date));

    /**
     * Verify if hourStart is before
     */
    if (isBefore(hourStart, new Date())) {
      throw new Error('Past dates are not permitted ');
    }

    /**
     * Check date availability
     */
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart
      }
    });

    if (checkAvailability) {
      throw new Error('Appointment date is not available');
    }

    const appointment = await Appointment.create({
      user_id,
      provider_id,
      date: hourStart
    });

    /**
     * Notify appointment provider
     */
    const user = await User.findByPk(user_id);
    const formattedDate = format(
      hourStart,
      "'dia' dd 'de' MMMM', às' H:mm'h'",
      { locale: pt }
    );

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formattedDate}`,
      user: provider_id
    });

    /**
     * Invalidate cache
     */
    await Cache.invalidatePrefix(`user:${user.id}:appointment`);

    return appointment;
  }
}

export default new CreateAppointmentService();
